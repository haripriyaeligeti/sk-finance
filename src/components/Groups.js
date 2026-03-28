import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [editingGroupId, setEditingGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [monthlyShare, setMonthlyShare] = useState("");
  const [memberCapacity, setMemberCapacity] = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [status, setStatus] = useState("Active");
  const startMonthInputRef = useRef(null);

  const resetForm = () => {
    setEditingGroupId("");
    setGroupName("");
    setMonthlyShare("");
    setMemberCapacity("");
    setDurationMonths("");
    setStartMonth("");
    setStatus("Active");
  };

  const fetchGroups = async () => {
    const [groupsSnapshot, groupMembersSnapshot] = await Promise.all([
      getDocs(collection(db, "groups")),
      getDocs(collection(db, "groupMembers")),
    ]);

    setGroups(
      groupsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
    setGroupMembers(
      groupMembersSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })),
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

    resetForm();
    fetchGroups();
  };

  const startEditingGroup = (group) => {
    setEditingGroupId(group.id);
    setGroupName(group.groupName || "");
    setMonthlyShare(String(group.monthlyShare || ""));
    setMemberCapacity(String(group.memberCapacity || ""));
    setDurationMonths(String(group.durationMonths || ""));
    setStartMonth(group.startMonth || "");
    setStatus(group.status || "Active");
  };

  const updateGroupDetails = async () => {
    const trimmedName = groupName.trim();
    const resolvedMonthlyShare = Number(monthlyShare);
    const resolvedMemberCapacity = Number(memberCapacity);
    const resolvedDurationMonths = Number(durationMonths);

    if (
      !editingGroupId ||
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
    const duplicateGroup = querySnapshot.docs.find(
      (groupDoc) => groupDoc.id !== editingGroupId,
    );

    if (duplicateGroup) {
      alert("Group name already exists.");
      return;
    }

    await updateDoc(doc(db, "groups", editingGroupId), {
      groupName: trimmedName,
      normalizedGroupName: trimmedName.toLowerCase(),
      monthlyShare: resolvedMonthlyShare,
      memberCapacity: resolvedMemberCapacity,
      durationMonths: resolvedDurationMonths,
      startMonth,
      status,
    });

    const relatedMembers = groupMembers.filter(
      (member) => member.groupId === editingGroupId,
    );

    await Promise.all(
      relatedMembers.map((member) =>
        updateDoc(doc(db, "groupMembers", member.id), {
          groupName: trimmedName,
          monthlyContribution:
            resolvedMonthlyShare * Math.max(Number(member.shareCount || 1), 1),
        }),
      ),
    );

    resetForm();
    fetchGroups();
  };

  const deleteGroup = async (id, groupName) => {
    const shouldDelete = window.confirm(
      `Are you sure you want to delete group ${groupName || ""}?`.trim(),
    );

    if (!shouldDelete) {
      return;
    }

    await deleteDoc(doc(db, "groups", id));
    if (editingGroupId === id) {
      resetForm();
    }
    fetchGroups();
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openStartMonthPicker = () => {
    const input = startMonthInputRef.current;

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
            ref={startMonthInputRef}
            type="month"
            value={startMonth}
            onChange={(event) => setStartMonth(event.target.value)}
            onClick={openStartMonthPicker}
            onFocus={openStartMonthPicker}
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

      <div className="action-row action-row-split">
        <button
          className="primary-button"
          onClick={editingGroupId ? updateGroupDetails : addGroup}
        >
          {editingGroupId ? "Update group" : "Add group"}
        </button>
        {editingGroupId ? (
          <button className="ghost-button" onClick={resetForm}>
            Cancel edit
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Monthly Share</th>
              <th>Capacity</th>
              <th>Occupied Shares</th>
              <th>Duration</th>
              <th>Start</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const occupiedShares = groupMembers
                .filter((member) => member.groupId === group.id)
                .reduce(
                  (total, member) => total + Number(member.shareCount || 1),
                  0,
                );

              return (
                <tr key={group.id}>
                  <td>
                    <div className="name-with-action">
                      <span>{group.groupName}</span>
                      <button
                        className="icon-button"
                        onClick={() => startEditingGroup(group)}
                        aria-label={`Edit ${group.groupName}`}
                        title="Edit group"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25zm15.71-9.04a.996.996 0 0 0 0-1.41l-2.51-2.51a.996.996 0 1 0-1.41 1.41l2.51 2.51a.996.996 0 0 0 1.41 0z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td>{currencyFormatter.format(group.monthlyShare || 0)}</td>
                  <td>{group.memberCapacity || "-"}</td>
                  <td>
                    {occupiedShares} / {group.memberCapacity || 0}
                  </td>
                  <td>{group.durationMonths || "-"}</td>
                  <td>{group.startMonth || "-"}</td>
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
                      onClick={() => deleteGroup(group.id, group.groupName)}
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
