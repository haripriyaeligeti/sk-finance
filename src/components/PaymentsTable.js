import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const PaymentsTable = () => {
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [groupMemberId, setGroupMemberId] = useState("");
  const [cycleMonth, setCycleMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [status, setStatus] = useState("Paid");
  const [notes, setNotes] = useState("");

  const fetchPayments = async () => {
    const [groupsSnapshot, membershipsSnapshot, paymentsSnapshot] =
      await Promise.all([
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "groupMembers")),
        getDocs(collection(db, "payments")),
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
      paymentsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filteredMemberships = memberships.filter(
    (membership) => membership.groupId === groupId,
  );

  const addPayment = async () => {
    const selectedMembership = memberships.find(
      (membership) => membership.id === groupMemberId,
    );
    const selectedGroup = groups.find((group) => group.id === groupId);

    if (!selectedMembership || !selectedGroup || !cycleMonth || !amount) {
      alert("Select group, customer, cycle month, and amount.");
      return;
    }

    await addDoc(collection(db, "payments"), {
      groupId,
      groupName: selectedGroup.groupName,
      groupMemberId,
      personId: selectedMembership.personId,
      memberName: selectedMembership.memberName,
      cycleMonth,
      amount: Number(amount),
      paidOn,
      paymentMode,
      status,
      notes: notes.trim(),
      createdAt: Timestamp.now(),
    });

    setGroupId("");
    setGroupMemberId("");
    setCycleMonth("");
    setAmount("");
    setPaidOn("");
    setPaymentMode("Cash");
    setStatus("Paid");
    setNotes("");
    fetchPayments();
  };

  const deletePayment = async (id) => {
    await deleteDoc(doc(db, "payments", id));
    fetchPayments();
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Collections</p>
          <h2>Monthly Payments</h2>
        </div>
        <p className="section-note">
          Log each member payment per month instead of creating a new
          spreadsheet tab.
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
          Member
          <select
            value={groupMemberId}
            onChange={(event) => {
              const nextMembershipId = event.target.value;
              const nextMembership = memberships.find(
                (membership) => membership.id === nextMembershipId,
              );

              setGroupMemberId(nextMembershipId);
              setAmount(
                nextMembership
                  ? String(nextMembership.monthlyContribution || "")
                  : "",
              );
            }}
          >
            <option value="">Select member</option>
            {filteredMemberships.map((membership) => (
              <option key={membership.id} value={membership.id}>
                {membership.memberName}
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
        <label>
          Amount
          <input
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Paid on
          <input
            type="date"
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </label>
        <label>
          Mode
          <select
            value={paymentMode}
            onChange={(event) => setPaymentMode(event.target.value)}
          >
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
          </select>
        </label>
        <label className="full-width">
          Notes
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Receipt number or remarks"
          />
        </label>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={addPayment}>
          Add payment
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Member</th>
              <th>Cycle</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Paid On</th>
              <th>Mode</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.groupName || payment.groupId}</td>
                <td>{payment.memberName || payment.personId}</td>
                <td>{payment.cycleMonth || "-"}</td>
                <td>{currencyFormatter.format(payment.amount || 0)}</td>
                <td>
                  <span
                    className={`status-pill ${String(payment.status || "").toLowerCase()}`}
                  >
                    {payment.status || "Paid"}
                  </span>
                </td>
                <td>{payment.paidOn || "-"}</td>
                <td>{payment.paymentMode || "-"}</td>
                <td>
                  <button
                    className="ghost-button"
                    onClick={() => deletePayment(payment.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default PaymentsTable;
