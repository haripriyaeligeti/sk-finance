import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../firebase";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const getRunningMonthNumber = (startMonth, cycleMonth) => {
  if (!startMonth || !cycleMonth) {
    return null;
  }

  const [startYear, startMonthIndex] = startMonth.split("-").map(Number);
  const [cycleYear, cycleMonthIndex] = cycleMonth.split("-").map(Number);

  if (!startYear || !startMonthIndex || !cycleYear || !cycleMonthIndex) {
    return null;
  }

  const monthDifference =
    (cycleYear - startYear) * 12 + (cycleMonthIndex - startMonthIndex);

  if (monthDifference < 0) {
    return null;
  }

  return monthDifference + 1;
};

const MonthlyCollectionStatementBuilder = () => {
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [releases, setReleases] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [cycleMonth, setCycleMonth] = useState("");
  const [editingRowId, setEditingRowId] = useState("");
  const cycleMonthInputRef = useRef(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paidOn: "",
    paymentMode: "Cash",
    status: "Pending",
    notes: "",
  });
  const [savingRowId, setSavingRowId] = useState("");

  const fetchStatementData = async () => {
    const [
      groupsSnapshot,
      membershipsSnapshot,
      paymentsSnapshot,
      releasesSnapshot,
    ] = await Promise.all([
      getDocs(collection(db, "groups")),
      getDocs(collection(db, "groupMembers")),
      getDocs(collection(db, "payments")),
      getDocs(collection(db, "releases")),
    ]);

    setGroups(
      groupsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
    setMemberships(
      membershipsSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })),
    );
    setPayments(
      paymentsSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })),
    );
    setReleases(
      releasesSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })),
    );
  };

  useEffect(() => {
    fetchStatementData();
  }, []);

  const selectedGroup = groups.find((group) => group.id === groupId);
  const runningMonthNumber = getRunningMonthNumber(
    selectedGroup?.startMonth,
    cycleMonth,
  );
  const isBeforeGroupStart =
    Boolean(selectedGroup && cycleMonth) && runningMonthNumber === null;

  const statementData = useMemo(() => {
    if (!selectedGroup || !cycleMonth || runningMonthNumber === null) {
      return null;
    }

    const groupMemberships = memberships.filter(
      (membership) => membership.groupId === groupId,
    );
    const cyclePayments = payments.filter(
      (payment) =>
        payment.groupId === groupId && payment.cycleMonth === cycleMonth,
    );
    const paymentMap = new Map(
      cyclePayments
        .filter((payment) => payment.groupMemberShareKey)
        .map((payment) => [payment.groupMemberShareKey, payment]),
    );
    const legacyPaymentMap = new Map(
      cyclePayments
        .filter((payment) => !payment.groupMemberShareKey)
        .map((payment) => [payment.groupMemberId, payment]),
    );
    const release =
      releases.find(
        (entry) => entry.groupId === groupId && entry.cycleMonth === cycleMonth,
      ) || null;
    const priorReleaseMap = new Map(
      releases
        .filter(
          (entry) =>
            entry.groupId === groupId &&
            entry.groupMemberShareKey &&
            entry.cycleMonth < cycleMonth,
        )
        .sort((left, right) => left.cycleMonth.localeCompare(right.cycleMonth))
        .map((entry) => [entry.groupMemberShareKey, entry]),
    );
    const activeReleaseMap = new Map(
      releases
        .filter(
          (entry) =>
            entry.groupId === groupId &&
            entry.groupMemberShareKey &&
            entry.cycleMonth <= cycleMonth,
        )
        .sort((left, right) => left.cycleMonth.localeCompare(right.cycleMonth))
        .map((entry) => [entry.groupMemberShareKey, entry]),
    );
    const totalsByMemberName = new Map();

    groupMemberships.forEach((membership) => {
      const baseMemberName = membership.memberName || membership.personId;
      totalsByMemberName.set(
        baseMemberName,
        (totalsByMemberName.get(baseMemberName) || 0) +
          Math.max(Number(membership.shareCount || 1), 1),
      );
    });

    const memberSequenceMap = new Map();

    const rows = groupMemberships.flatMap((membership) => {
      const shareCount = Math.max(Number(membership.shareCount || 1), 1);
      const baseMemberName = membership.memberName || membership.personId;
      const expectedAmount = Number(
        selectedGroup.monthlyShare ||
          Number(membership.monthlyContribution || 0) / shareCount ||
          0,
      );

      return Array.from({ length: shareCount }, (_, index) => {
        const shareIndex = index + 1;
        const nextSequence = (memberSequenceMap.get(baseMemberName) || 0) + 1;
        memberSequenceMap.set(baseMemberName, nextSequence);
        const totalCount = totalsByMemberName.get(baseMemberName) || 1;

        const groupMemberShareKey = `${membership.id}-${shareIndex}`;
        const payment =
          paymentMap.get(groupMemberShareKey) ||
          (shareCount === 1 ? legacyPaymentMap.get(membership.id) : null);
        const priorRelease = priorReleaseMap.get(groupMemberShareKey);
        const activeRelease = activeReleaseMap.get(groupMemberShareKey);
        const resolvedExpectedAmount = priorRelease
          ? Number(priorRelease.nextCycleAmount || expectedAmount)
          : expectedAmount;
        const paidAmount = Number(payment?.amount || 0);

        return {
          rowId: groupMemberShareKey,
          groupMemberId: membership.id,
          groupMemberShareKey,
          shareIndex,
          personId: membership.personId,
          baseMemberName,
          memberName:
            totalCount > 1
              ? `${baseMemberName}-${nextSequence}`
              : baseMemberName,
          shareCount,
          expectedAmount: resolvedExpectedAmount,
          paidAmount,
          balanceAmount: Math.max(resolvedExpectedAmount - paidAmount, 0),
          paymentId: payment?.id || "",
          paymentStatus: payment?.status || "Pending",
          paidOn: payment?.paidOn || "",
          paymentMode: payment?.paymentMode || "Cash",
          releasedOn: activeRelease?.releasedOn || "",
          notes: payment?.notes || "",
        };
      });
    });

    const totalExpected = rows.reduce(
      (total, row) => total + row.expectedAmount,
      0,
    );
    const totalCollected = rows.reduce(
      (total, row) => total + row.paidAmount,
      0,
    );
    const totalOutstanding = rows.reduce(
      (total, row) => total + row.balanceAmount,
      0,
    );
    const paidCount = rows.filter((row) => row.paymentStatus === "Paid").length;
    const pendingCount = rows.filter(
      (row) => row.paymentStatus !== "Paid",
    ).length;
    const potValue =
      Number(selectedGroup.monthlyShare || 0) *
      Number(selectedGroup.memberCapacity || 0);

    return {
      rows,
      release,
      totalExpected,
      totalCollected,
      totalOutstanding,
      paidCount,
      pendingCount,
      potValue,
    };
  }, [
    cycleMonth,
    groupId,
    memberships,
    payments,
    releases,
    runningMonthNumber,
    selectedGroup,
  ]);

  const startEditingRow = (row) => {
    setEditingRowId(row.rowId);
    setPaymentForm({
      amount: String(row.paidAmount || row.expectedAmount || ""),
      paidOn: row.paidOn || "",
      paymentMode: row.paymentMode || "Cash",
      status: row.paymentStatus || "Pending",
      notes: row.notes || "",
    });
  };

  const cancelEditingRow = () => {
    setEditingRowId("");
    setPaymentForm({
      amount: "",
      paidOn: "",
      paymentMode: "Cash",
      status: "Pending",
      notes: "",
    });
  };

  const savePaymentRow = async (row) => {
    if (!selectedGroup || !cycleMonth) {
      alert("Select a group and cycle month first.");
      return;
    }

    const resolvedAmount = Number(paymentForm.amount || 0);

    setSavingRowId(row.rowId);

    try {
      const paymentPayload = {
        groupId,
        groupName: selectedGroup.groupName,
        groupMemberId: row.groupMemberId,
        groupMemberShareKey: row.groupMemberShareKey,
        shareIndex: row.shareIndex,
        personId: row.personId,
        memberName: row.memberName,
        baseMemberName: row.baseMemberName,
        cycleMonth,
        amount: resolvedAmount,
        paidOn: paymentForm.paidOn,
        paymentMode: paymentForm.paymentMode,
        status: paymentForm.status,
        notes: paymentForm.notes.trim(),
      };

      if (row.paymentId) {
        await updateDoc(doc(db, "payments", row.paymentId), paymentPayload);
      } else {
        await addDoc(collection(db, "payments"), {
          ...paymentPayload,
          createdAt: Timestamp.now(),
        });
      }

      await fetchStatementData();
      cancelEditingRow();
    } finally {
      setSavingRowId("");
    }
  };

  const downloadStatement = () => {
    if (isBeforeGroupStart) {
      alert("The selected cycle month is before the group's start month.");
      return;
    }

    if (!selectedGroup || !cycleMonth || !statementData) {
      alert("Select a group and cycle month to generate the statement.");
      return;
    }

    const document = new jsPDF({ unit: "pt", format: "a4" });
    const generatedDate = new Date().toLocaleDateString("en-IN");

    document.setFontSize(18);
    document.text("Sai Krishna Chit Finance", 40, 44);
    document.setFontSize(12);
    document.text("Monthly Statement", 40, 66);

    document.setFontSize(10);
    document.text(`Group: ${selectedGroup.groupName}`, 40, 92);
    document.text(`Cycle Month: ${cycleMonth}`, 40, 108);
    document.text(`Generated On: ${generatedDate}`, 40, 124);
    document.text(
      `Monthly Share: ${currencyFormatter.format(selectedGroup.monthlyShare || 0)}`,
      320,
      92,
    );
    document.text(
      `Member Capacity: ${selectedGroup.memberCapacity || "-"}`,
      320,
      108,
    );
    document.text(
      `Pot Value: ${currencyFormatter.format(statementData.potValue)}`,
      320,
      124,
    );
    document.text(
      `Running Month: ${runningMonthNumber ? `${runningMonthNumber} / ${selectedGroup.durationMonths || "-"}` : "-"}`,
      320,
      140,
    );

    autoTable(document, {
      startY: 162,
      head: [["Metric", "Value"]],
      body: [
        [
          "Running Month",
          runningMonthNumber
            ? `${runningMonthNumber} / ${selectedGroup.durationMonths || "-"}`
            : "-",
        ],
        [
          "Total Expected",
          currencyFormatter.format(statementData.totalExpected),
        ],
        [
          "Total Collected",
          currencyFormatter.format(statementData.totalCollected),
        ],
        [
          "Outstanding",
          currencyFormatter.format(statementData.totalOutstanding),
        ],
        ["Paid Shares", String(statementData.paidCount)],
        ["Pending Shares", String(statementData.pendingCount)],
      ],
      theme: "grid",
      headStyles: { fillColor: [140, 63, 44] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 160 },
      },
      margin: { left: 40, right: 40 },
      tableWidth: 250,
    });

    const releaseRows = statementData.release
      ? [
          ["Winner", statementData.release.memberName || "-"],
          ["Released On", statementData.release.releasedOn || "-"],
          [
            "Discount",
            currencyFormatter.format(statementData.release.discountAmount || 0),
          ],
          [
            "Released Amount",
            currencyFormatter.format(statementData.release.releasedAmount || 0),
          ],
          [
            "Dividend / Member",
            currencyFormatter.format(
              statementData.release.dividendPerMember || 0,
            ),
          ],
        ]
      : [["Release Status", "No release recorded for this cycle yet"]];

    autoTable(document, {
      startY: 162,
      margin: { left: 320, right: 40 },
      head: [["Release Summary", "Value"]],
      body: releaseRows,
      theme: "grid",
      headStyles: { fillColor: [89, 116, 83] },
      styles: { fontSize: 9 },
      tableWidth: 235,
    });

    autoTable(document, {
      startY: Math.max(document.lastAutoTable.finalY + 20, 300),
      head: [
        [
          "Member",
          "Share",
          "Expected",
          "Collected",
          "Balance",
          "Status",
          "Released Date",
          "Paid On",
          "Mode",
        ],
      ],
      body: statementData.rows.map((row) => [
        row.memberName,
        row.shareIndex,
        currencyFormatter.format(row.expectedAmount),
        currencyFormatter.format(row.paidAmount),
        currencyFormatter.format(row.balanceAmount),
        row.paymentStatus,
        row.releasedOn || "-",
        row.paidOn,
        row.paymentMode,
      ]),
      theme: "striped",
      headStyles: { fillColor: [32, 21, 15] },
      styles: { fontSize: 8, cellPadding: 5 },
      margin: { left: 40, right: 40 },
    });

    document.setFontSize(9);
    document.text(
      "This statement was generated from Firestore payment and release records.",
      40,
      document.internal.pageSize.height - 24,
    );

    const fileName = `${selectedGroup.groupName}-${cycleMonth}-statement.pdf`
      .toLowerCase()
      .replace(/\s+/g, "-");

    document.save(fileName);
  };

  const openCycleMonthPicker = () => {
    const input = cycleMonthInputRef.current;

    if (!input || typeof input.showPicker !== "function") {
      return;
    }

    try {
      input.showPicker();
    } catch {
      // Some browsers restrict programmatic picker opening outside user gestures.
    }
  };

  return (
    <section className="panel statement-panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Statements</p>
          <h2>View, Edit, and Download Statement</h2>
        </div>
        <p className="section-note">
          Pick a group and month, update member payment entries inline, and
          download the final statement as a PDF.
        </p>
      </div>

      <div className="form-grid">
        <label>
          Group
          <select
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
          >
            <option value="">Select group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.groupName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cycle month
          <input
            ref={cycleMonthInputRef}
            type="month"
            value={cycleMonth}
            onChange={(event) => setCycleMonth(event.target.value)}
            onClick={openCycleMonthPicker}
            onFocus={openCycleMonthPicker}
          />
        </label>
      </div>

      <div className="action-row action-row-split">
        <button className="primary-button" onClick={downloadStatement}>
          Download statement PDF
        </button>
        <span className="action-hint">
          This page can be used as the month-wise collection sheet. Updates here
          write to the payments table.
        </span>
      </div>

      {selectedGroup && statementData ? (
        <div className="statement-preview">
          <div className="preview-grid">
            <article className="preview-card">
              <span>Total Expected</span>
              <strong>
                {currencyFormatter.format(statementData.totalExpected)}
              </strong>
            </article>
            <article className="preview-card">
              <span>Total Collected</span>
              <strong>
                {currencyFormatter.format(statementData.totalCollected)}
              </strong>
            </article>
            <article className="preview-card">
              <span>Outstanding</span>
              <strong>
                {currencyFormatter.format(statementData.totalOutstanding)}
              </strong>
            </article>
            <article className="preview-card">
              <span>Release</span>
              <strong>
                {statementData.release
                  ? currencyFormatter.format(
                      statementData.release.releasedAmount || 0,
                    )
                  : "Not recorded"}
              </strong>
            </article>
          </div>

          <div className="statement-meta">
            <p>
              <strong>Group:</strong> {selectedGroup.groupName}
            </p>
            <p>
              <strong>Month:</strong> {cycleMonth}
            </p>
            <p>
              <strong>Running Month:</strong>{" "}
              {runningMonthNumber
                ? `${runningMonthNumber} / ${selectedGroup.durationMonths || "-"}`
                : "-"}
            </p>
            <p>
              <strong>Paid:</strong> {statementData.paidCount}
            </p>
            <p>
              <strong>Pending:</strong> {statementData.pendingCount}
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Share</th>
                  <th>Expected</th>
                  <th>Collected</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Released Date</th>
                  <th>Paid On</th>
                  <th>Mode</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {statementData.rows.map((row) => (
                  <tr
                    key={row.rowId}
                    className={editingRowId === row.rowId ? "row-editing" : ""}
                  >
                    <td>{row.memberName}</td>
                    <td>{row.shareIndex}</td>
                    <td>{currencyFormatter.format(row.expectedAmount)}</td>
                    <td>
                      {editingRowId === row.rowId ? (
                        <input
                          className="table-input"
                          type="number"
                          value={paymentForm.amount}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        currencyFormatter.format(row.paidAmount)
                      )}
                    </td>
                    <td>{currencyFormatter.format(row.balanceAmount)}</td>
                    <td>
                      {editingRowId === row.rowId ? (
                        <select
                          className="table-select"
                          value={paymentForm.status}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              status: event.target.value,
                            }))
                          }
                        >
                          <option value="Paid">Paid</option>
                          <option value="Pending">Pending</option>
                          <option value="Partial">Partial</option>
                        </select>
                      ) : (
                        <span
                          className={`status-pill ${String(row.paymentStatus).toLowerCase()}`}
                        >
                          {row.paymentStatus}
                        </span>
                      )}
                    </td>
                    <td>{row.releasedOn || "-"}</td>
                    <td>
                      {editingRowId === row.rowId ? (
                        <input
                          className="table-input"
                          type="date"
                          value={paymentForm.paidOn}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              paidOn: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        row.paidOn || "-"
                      )}
                    </td>
                    <td>
                      {editingRowId === row.rowId ? (
                        <select
                          className="table-select"
                          value={paymentForm.paymentMode}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              paymentMode: event.target.value,
                            }))
                          }
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      ) : (
                        row.paymentMode || "-"
                      )}
                    </td>
                    <td>
                      {editingRowId === row.rowId ? (
                        <input
                          className="table-input"
                          value={paymentForm.notes}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Receipt or remarks"
                        />
                      ) : (
                        row.notes || "-"
                      )}
                    </td>
                    <td>
                      {editingRowId === row.rowId ? (
                        <div className="row-actions">
                          <button
                            className="primary-button compact-button"
                            onClick={() => savePaymentRow(row)}
                            disabled={savingRowId === row.rowId}
                          >
                            {savingRowId === row.rowId ? "Saving..." : "Save"}
                          </button>
                          <button
                            className="ghost-button compact-button"
                            onClick={cancelEditingRow}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="ghost-button compact-button"
                          onClick={() => startEditingRow(row)}
                        >
                          {row.paymentId ? "Edit" : "Add"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          {isBeforeGroupStart
            ? `This group starts in ${selectedGroup.startMonth}. Select that month or a later cycle month to view the statement.`
            : "Select a group and cycle month to preview the month-end statement."}
        </div>
      )}
    </section>
  );
};

export default MonthlyCollectionStatementBuilder;
