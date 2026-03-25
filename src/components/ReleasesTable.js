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

const ReleasesTable = () => {
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [releases, setReleases] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [groupMemberId, setGroupMemberId] = useState("");
  const [cycleMonth, setCycleMonth] = useState("");
  const [releasedOn, setReleasedOn] = useState("");
  const [notes, setNotes] = useState("");

  const fetchReleases = async () => {
    const [groupsSnapshot, membershipsSnapshot, releasesSnapshot] =
      await Promise.all([
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "groupMembers")),
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
    setReleases(
      releasesSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const filteredMemberships = memberships.filter(
    (membership) => membership.groupId === groupId,
  );

  const addRelease = async () => {
    const selectedGroup = groups.find((group) => group.id === groupId);
    const selectedMembership = memberships.find(
      (membership) => membership.id === groupMemberId,
    );

    if (!selectedGroup || !selectedMembership || !cycleMonth) {
      alert("Select a group, member, and cycle month.");
      return;
    }

    await addDoc(collection(db, "releases"), {
      groupId,
      groupName: selectedGroup.groupName,
      groupMemberId,
      personId: selectedMembership.personId,
      memberName: selectedMembership.memberName,
      cycleMonth,
      releasedOn,
      notes: notes.trim(),
      createdAt: Timestamp.now(),
    });

    setGroupId("");
    setGroupMemberId("");
    setCycleMonth("");
    setReleasedOn("");
    setNotes("");
    fetchReleases();
  };

  const deleteRelease = async (id, memberName) => {
    const shouldDelete = window.confirm(
      `Are you sure you want to delete release record for ${memberName || "this member"}?`,
    );

    if (!shouldDelete) {
      return;
    }

    await deleteDoc(doc(db, "releases", id));
    fetchReleases();
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Releases</h2>
        </div>
        <p className="section-note">Track Released Members</p>
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
          Group Member
          <select
            value={groupMemberId}
            onChange={(event) => setGroupMemberId(event.target.value)}
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
          Released on
          <input
            type="date"
            value={releasedOn}
            onChange={(event) => setReleasedOn(event.target.value)}
          />
        </label>
        <label className="full-width">
          Notes
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Surety, cheque, or remarks"
          />
        </label>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={addRelease}>
          Add release
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Winner</th>
              <th>Cycle</th>
              <th>Released on</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr key={release.id}>
                <td>{release.groupName || release.groupId}</td>
                <td>{release.memberName || release.personId}</td>
                <td>{release.cycleMonth || "-"}</td>
                <td>{release.releasedOn || "-"}</td>
                <td>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      deleteRelease(
                        release.id,
                        release.memberName || release.personId,
                      )
                    }
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

export default ReleasesTable;
