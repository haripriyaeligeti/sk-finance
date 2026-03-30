import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  buildStatementData,
  currencyFormatter,
  downloadStatementPdf,
  getRunningMonthNumber,
} from "./statementUtils";

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

  const statementData = useMemo(
    () =>
      buildStatementData({
        selectedGroup,
        cycleMonth,
        groupId,
        memberships,
        payments,
        releases,
        runningMonthNumber,
      }),
    [
      cycleMonth,
      groupId,
      memberships,
      payments,
      releases,
      runningMonthNumber,
      selectedGroup,
    ],
  );
  const groupMemberCount = statementData
    ? statementData.rows.filter((row) => !row.isPlaceholder).length
    : 0;

  const startEditingRow = (row) => {
    if (row.isPlaceholder) {
      return;
    }

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
    if (row.isPlaceholder) {
      return;
    }

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
        // groupMemberShareKey: row.groupMemberShareKey,
        // shareIndex: row.shareIndex,
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

  const downloadStatement = () => {
    if (isBeforeGroupStart) {
      alert("The selected cycle month is before the group's start month.");
      return;
    }

    if (!selectedGroup || !cycleMonth || !statementData) {
      alert("Select a group and cycle month to generate the statement.");
      return;
    }

    downloadStatementPdf({
      selectedGroup,
      cycleMonth,
      runningMonthNumber,
      statementData,
    });
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
          Review and update the month-wise collection sheet here, then download
          the statement PDF from the same page.
        </span>
      </div>

      {selectedGroup && statementData ? (
        <div className="statement-preview">
          <div className="preview-grid">
            <article className="preview-card">
              <span>Released Members</span>
              <strong>{statementData.releaseMemberCount}</strong>
            </article>
            <article className="preview-card">
              <span>Expected Amount</span>
              <strong>
                {currencyFormatter.format(statementData.totalExpected)}
              </strong>
            </article>
            <article className="preview-card">
              <span>Collected Amount</span>
              <strong>
                {currencyFormatter.format(statementData.totalCollected)}
              </strong>
            </article>
            <article className="preview-card">
              <span>Pending Amount</span>
              <strong>
                {currencyFormatter.format(statementData.totalOutstanding)}
              </strong>
            </article>
            <article className="preview-card">
              <span>No. of Group Members</span>
              <strong>{groupMemberCount}</strong>
            </article>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Member</th>
                  {/* <th>Share</th> */}
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
                {statementData.rows.map((row, index) => (
                  <tr
                    key={row.rowId}
                    className={editingRowId === row.rowId ? "row-editing" : ""}
                  >
                    <td>{index + 1}</td>
                    <td>{row.memberName}</td>
                    {/* <td>{row.shareIndex}</td> */}
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
                      ) : row.isPlaceholder ? (
                        "-"
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
