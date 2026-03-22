import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [monthlyShare, setMonthlyShare] = useState("");
  const [memberCapacity, setMemberCapacity] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [status, setStatus] = useState("Active");

  const fetchGroups = async () => {
    const snapshot = await getDocs(collection(db, "groups"));
    setGroups(
      snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
  };

  const addGroup = async () => {
    const trimmedName = groupName.trim();

    if (
      !trimmedName ||
      !monthlyShare ||
      !memberCapacity ||
      !durationMonths ||
      !startMonth
    ) {
      alert("Enter all required group details.");
      return;
    }

    const q = query(
      collection(db, "groups"),
      where("normalizedGroupName", "==", trimmedName.toLowerCase()),
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      alert("Group name already exists.");
      return;
    }

    await addDoc(collection(db, "groups"), {
      groupName: trimmedName,
      normalizedGroupName: trimmedName.toLowerCase(),
      monthlyShare: Number(monthlyShare),
      memberCapacity: Number(memberCapacity),
      durationMonths: Number(durationMonths),
      startMonth,
      status,
      createdAt: Timestamp.now(),
    });

    setGroupName("");
    setMonthlyShare("");
    setMemberCapacity("");
    setDurationMonths("");
    setStartMonth("");
    setStatus("Active");
    fetchGroups();
  };

  const deleteGroup = async (id) => {
    await deleteDoc(doc(db, "groups", id));
    fetchGroups();
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Master Data</p>
          <h2>Chit Groups</h2>
        </div>
        <p className="section-note">
          Define monthly amount, duration, and member capacity for each chit.
        </p>
      </div>

      <div className="form-grid">
        <label>
          Group name
          <input
            placeholder="SK 1 Lakh - 20 Months"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
        </label>
        <label>
          Monthly share
          <input
            placeholder="5000"
            type="number"
            value={monthlyShare}
            onChange={(event) => setMonthlyShare(event.target.value)}
          />
        </label>
        <label>
          Member capacity
          <input
            placeholder="20"
            type="number"
            value={memberCapacity}
            onChange={(event) => setMemberCapacity(event.target.value)}
          />
        </label>
        <label>
          Duration in months
          <input
            placeholder="20"
            type="number"
            value={durationMonths}
            onChange={(event) => setDurationMonths(event.target.value)}
          />
        </label>
        <label>
          Start month
          <input
            type="month"
            value={startMonth}
            onChange={(event) => setStartMonth(event.target.value)}
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="Active">Active</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Closed">Closed</option>
          </select>
        </label>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={addGroup}>
          Add group
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Monthly Share</th>
              <th>Capacity</th>
              <th>Duration</th>
              <th>Start</th>
              <th>Pot Value</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const potValue =
                Number(group.monthlyShare || 0) *
                Number(group.memberCapacity || 0);

              return (
                <tr key={group.id}>
                  <td>{group.groupName}</td>
                  <td>{currencyFormatter.format(group.monthlyShare || 0)}</td>
                  <td>{group.memberCapacity || "-"}</td>
                  <td>{group.durationMonths || "-"}</td>
                  <td>{group.startMonth || "-"}</td>
                  <td>{currencyFormatter.format(potValue)}</td>
                  <td>
                    <span
                      className={`status-pill ${String(group.status || "").toLowerCase()}`}
                    >
                      {group.status || "Active"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="ghost-button"
                      onClick={() => deleteGroup(group.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default Groups;
