import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../firebase";
import {
  buildStatementData,
  currencyFormatter,
  getRunningMonthNumber,
} from "./statementUtils";

const formatPdfCurrency = (amount) => {
  const numericAmount = Number(amount || 0);

  return numericAmount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
};

const formatShortDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}-${month}-${year}`;
};

const formatOrdinal = (value) => {
  const numericValue = Number(value || 0);
  const remainderTen = numericValue % 10;
  const remainderHundred = numericValue % 100;

  if (remainderTen === 1 && remainderHundred !== 11) {
    return `${numericValue}st`;
  }

  if (remainderTen === 2 && remainderHundred !== 12) {
    return `${numericValue}nd`;
  }

  if (remainderTen === 3 && remainderHundred !== 13) {
    return `${numericValue}rd`;
  }

  return `${numericValue}th`;
};

const buildStatementSummaryLine = ({
  summaryDate,
  runningMonthNumber,
  selectedGroup,
  statementData,
}) => {
  const formattedMonth = runningMonthNumber
    ? `${formatOrdinal(runningMonthNumber)} Month`
    : "- Month";
  const GroupName = `${selectedGroup.groupName}`;
  const remainingMembers = `(${selectedGroup.memberCapacity}-${statementData.releaseMemberCount}=${Math.max(Number(selectedGroup.memberCapacity || 0) - Number(statementData.releaseMemberCount || 0), 0)})`;

  return `${summaryDate}  ${formattedMonth} ${GroupName} ${remainingMembers}`;
};

const StatementDocumentPage = () => {
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [releases, setReleases] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [cycleMonth, setCycleMonth] = useState("");
  const cycleMonthInputRef = useRef(null);

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
  const previewSummaryLine =
    selectedGroup && statementData
      ? buildStatementSummaryLine({
          summaryDate: formatShortDate(new Date()),
          runningMonthNumber,
          selectedGroup,
          statementData,
        })
      : "";

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
    const summaryLine = buildStatementSummaryLine({
      summaryDate: formatShortDate(new Date()),
      runningMonthNumber,
      selectedGroup,
      statementData,
    });
    const pageWidth = document.internal.pageSize.getWidth();

    document.setFontSize(10);
    document.text(
      summaryLine,
      Math.max((pageWidth - document.getTextWidth(summaryLine)) / 2, 12),
      30,
    );

    autoTable(document, {
      startY: 36,
      head: [
        [
          "S.No",
          "Member",
          "Expected",
          "Collected",
          "Balance",
          "Status",
          "Released Date",
          "Paid On",
          "Mode",
        ],
      ],
      body: statementData.rows.map((row, index) => [
        index + 1,
        row.memberName,
        // row.shareIndex || "-",
        formatPdfCurrency(row.expectedAmount),
        formatPdfCurrency(row.paidAmount),
        formatPdfCurrency(row.balanceAmount),
        row.paymentStatus,
        row.releasedOn || "-",
        row.paidOn || "-",
        row.paymentMode,
      ]),
      theme: "striped",
      styles: {
        fontSize: 8,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
        overflow: "ellipsize",
        valign: "middle",
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [32, 21, 15],
        fontSize: 8,
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        overflow: "linebreak",
        halign: "center",
        valign: "middle",
      },
      margin: { left: 40, right: 40, bottom: 20 },
      tableWidth: "auto",
      columnStyles: {
        0: { cellWidth: 28, halign: "center" },
        1: { cellWidth: 96 },
        2: { cellWidth: 58, halign: "right" },
        3: { cellWidth: 58, halign: "right" },
        4: { cellWidth: 54, halign: "right" },
        5: { cellWidth: 42, halign: "center" },
        6: { cellWidth: 72, halign: "center" },
        7: { cellWidth: 56, halign: "center" },
        8: { cellWidth: 42, halign: "center" },
      },
    });

    document.setFontSize(8);
    document.text(
      "This statement was generated from Firestore payment and release records.",
      40,
      document.internal.pageSize.height - 20,
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
          <p className="section-label">Documents</p>
          <h2>Statement Document</h2>
        </div>
        <p className="section-note">
          Open the reusable statement layout on its own page and download the
          final PDF when the sheet is ready.
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
          This page is reserved for the document format and download output.
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
            <article className="preview-card">
              <span>No. of Release Members</span>
              <strong>{statementData.releaseMemberCount}</strong>
            </article>
          </div>

          <div className="statement-meta">
            <p>{previewSummaryLine}</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Member</th>
                  <th>Expected</th>
                  <th>Collected</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Released Date</th>
                  <th>Paid On</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {statementData.rows.map((row, index) => (
                  <tr key={row.rowId}>
                    <td>{index + 1}</td>
                    <td>{row.memberName}</td>
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
                    <td>{row.releasedOn || "-"}</td>
                    <td>{row.paidOn || "-"}</td>
                    <td>{row.paymentMode || "-"}</td>
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
            : "Select a group and cycle month to preview the statement document."}
        </div>
      )}
    </section>
  );
};

export default StatementDocumentPage;
