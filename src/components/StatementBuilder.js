import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../firebase";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const StatementBuilder = () => {
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [releases, setReleases] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [cycleMonth, setCycleMonth] = useState("");

  useEffect(() => {
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

    fetchStatementData();
  }, []);

  const selectedGroup = groups.find((group) => group.id === groupId);

  const statementData = useMemo(() => {
    if (!selectedGroup || !cycleMonth) {
      return null;
    }

    const groupMemberships = memberships.filter(
      (membership) => membership.groupId === groupId,
    );
    const paymentMap = new Map(
      payments
        .filter(
          (payment) =>
            payment.groupId === groupId && payment.cycleMonth === cycleMonth,
        )
        .map((payment) => [payment.groupMemberId, payment]),
    );
    const release =
      releases.find(
        (entry) => entry.groupId === groupId && entry.cycleMonth === cycleMonth,
      ) || null;

    const rows = groupMemberships.map((membership) => {
      const payment = paymentMap.get(membership.id);
      const expectedAmount = Number(membership.monthlyContribution || 0);
      const paidAmount = Number(payment?.amount || 0);

      return {
        memberName: membership.memberName || membership.personId,
        shareCount: Number(membership.shareCount || 1),
        expectedAmount,
        paidAmount,
        balanceAmount: Math.max(expectedAmount - paidAmount, 0),
        paymentStatus: payment?.status || "Pending",
        paidOn: payment?.paidOn || "-",
        paymentMode: payment?.paymentMode || "-",
        notes: payment?.notes || "-",
      };
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
  }, [cycleMonth, groupId, memberships, payments, releases, selectedGroup]);

  const downloadStatement = () => {
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

    autoTable(document, {
      startY: 146,
      head: [["Metric", "Value"]],
      body: [
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
        ["Paid Members", String(statementData.paidCount)],
        ["Pending Members", String(statementData.pendingCount)],
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
      startY: 146,
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
          "Shares",
          "Expected",
          "Collected",
          "Balance",
          "Status",
          "Paid On",
          "Mode",
        ],
      ],
      body: statementData.rows.map((row) => [
        row.memberName,
        row.shareCount,
        currencyFormatter.format(row.expectedAmount),
        currencyFormatter.format(row.paidAmount),
        currencyFormatter.format(row.balanceAmount),
        row.paymentStatus,
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

  return (
    <section className="panel statement-panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Statements</p>
          <h2>Generate Monthly Statement</h2>
        </div>
        <p className="section-note">
          Pick a group and month, prepare the sheet-style summary, and download
          it as a PDF.
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
            type="month"
            value={cycleMonth}
            onChange={(event) => setCycleMonth(event.target.value)}
          />
        </label>
      </div>

      <div className="action-row action-row-split">
        <button className="primary-button" onClick={downloadStatement}>
          Download statement PDF
        </button>
        <span className="action-hint">
          Use this after collections and release details are entered for the
          month.
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
              <strong>Paid Members:</strong> {statementData.paidCount}
            </p>
            <p>
              <strong>Pending Members:</strong> {statementData.pendingCount}
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Shares</th>
                  <th>Expected</th>
                  <th>Collected</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Paid On</th>
                </tr>
              </thead>
              <tbody>
                {statementData.rows.map((row) => (
                  <tr key={`${row.memberName}-${row.paidOn}`}>
                    <td>{row.memberName}</td>
                    <td>{row.shareCount}</td>
                    <td>{currencyFormatter.format(row.expectedAmount)}</td>
                    <td>{currencyFormatter.format(row.paidAmount)}</td>
                    <td>{currencyFormatter.format(row.balanceAmount)}</td>
                    <td>
                      <span
                        className={`status-pill ${String(row.paymentStatus).toLowerCase()}`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td>{row.paidOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          Select a group and cycle month to preview the month-end statement.
        </div>
      )}
    </section>
  );
};

export default StatementBuilder;
