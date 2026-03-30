import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatPdfCurrency = (amount) => {
  const numericAmount = Number(amount || 0);

  return numericAmount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
};

export const formatShortDate = (date) => {
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

export const buildStatementSummaryLine = ({
  summaryDate,
  runningMonthNumber,
  selectedGroup,
  statementData,
}) => {
  const formattedMonth = runningMonthNumber
    ? `${formatOrdinal(runningMonthNumber)} Month`
    : "- Month";
  const groupName = `${selectedGroup.groupName}`;
  const remainingMembers = `(${selectedGroup.memberCapacity}-${statementData.releaseMemberCount}=${Math.max(Number(selectedGroup.memberCapacity || 0) - Number(statementData.releaseMemberCount || 0), 0)})`;

  return `${summaryDate}  ${formattedMonth} ${groupName} ${remainingMembers}`;
};

export const downloadStatementPdf = ({
  selectedGroup,
  cycleMonth,
  runningMonthNumber,
  statementData,
}) => {
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

export const getRunningMonthNumber = (startMonth, cycleMonth) => {
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

export const buildStatementData = ({
  selectedGroup,
  cycleMonth,
  groupId,
  memberships,
  payments,
  releases,
  runningMonthNumber,
}) => {
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
          totalCount > 1 ? `${baseMemberName}-${nextSequence}` : baseMemberName,
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
        isPlaceholder: false,
      };
    });
  });

  const memberCapacity = Math.max(Number(selectedGroup.memberCapacity || 0), 0);
  const expectedPlaceholderAmount = Number(selectedGroup.monthlyShare || 0);
  const placeholderRows =
    rows.length < memberCapacity
      ? Array.from({ length: memberCapacity - rows.length }, (_, index) => ({
          rowId: `empty-row-${index + 1}`,
          groupMemberId: "",
          groupMemberShareKey: "",
          shareIndex: "",
          personId: "",
          baseMemberName: "",
          memberName: "",
          shareCount: 0,
          expectedAmount: expectedPlaceholderAmount,
          paidAmount: expectedPlaceholderAmount,
          balanceAmount: 0,
          paymentId: "",
          paymentStatus: "Paid",
          paidOn: "",
          paymentMode: "",
          releasedOn: "",
          notes: "",
          isPlaceholder: true,
        }))
      : [];

  const statementRows = [...rows, ...placeholderRows];

  const totalExpected = statementRows.reduce(
    (total, row) => total + row.expectedAmount,
    0,
  );
  const totalCollected = statementRows.reduce(
    (total, row) => total + row.paidAmount,
    0,
  );
  const totalOutstanding = statementRows.reduce(
    (total, row) => total + row.balanceAmount,
    0,
  );
  const paidCount = statementRows.filter(
    (row) => row.paymentStatus === "Paid",
  ).length;
  const pendingCount = statementRows.filter(
    (row) => row.paymentStatus !== "Paid",
  ).length;
  const releaseMemberCount = statementRows.filter(
    (row) => !row.isPlaceholder && row.releasedOn,
  ).length;

  return {
    rows: statementRows,
    release,
    totalExpected,
    totalCollected,
    totalOutstanding,
    paidCount,
    pendingCount,
    releaseMemberCount,
  };
};
