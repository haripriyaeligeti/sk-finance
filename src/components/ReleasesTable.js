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

const ReleasesTable = () => {
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [releases, setReleases] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [groupMemberId, setGroupMemberId] = useState("");
  const [cycleMonth, setCycleMonth] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
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

    const potValue =
      Number(selectedGroup.monthlyShare || 0) *
      Number(selectedGroup.memberCapacity || 0);
    const resolvedDiscountAmount = Number(discountAmount || 0);
    const releasedAmount = Math.max(potValue - resolvedDiscountAmount, 0);
    const dividendPerMember = selectedGroup.memberCapacity
      ? resolvedDiscountAmount / Number(selectedGroup.memberCapacity)
      : 0;

    await addDoc(collection(db, "releases"), {
      groupId,
      groupName: selectedGroup.groupName,
      groupMemberId,
      personId: selectedMembership.personId,
      memberName: selectedMembership.memberName,
      cycleMonth,
      potValue,
      discountAmount: resolvedDiscountAmount,
      dividendPerMember,
      releasedAmount,
      releasedOn,
      notes: notes.trim(),
      createdAt: Timestamp.now(),
    });

    setGroupId("");
    setGroupMemberId("");
    setCycleMonth("");
    setDiscountAmount("");
    setReleasedOn("");
    setNotes("");
    fetchReleases();
  };

  const deleteRelease = async (id) => {
    await deleteDoc(doc(db, "releases", id));
    fetchReleases();
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Auction</p>
          <h2>Prize Releases</h2>
        </div>
        <p className="section-note">
          Track the winning member, discount, released amount, and dividend
          distribution.
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
          Prize winner
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
          Auction discount
          <input
            type="number"
            value={discountAmount}
            onChange={(event) => setDiscountAmount(event.target.value)}
            placeholder="Enter discount amount"
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
          Record release
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>Winner</th>
              <th>Cycle</th>
              <th>Pot</th>
              <th>Discount</th>
              <th>Released</th>
              <th>Dividend / Member</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr key={release.id}>
                <td>{release.groupName || release.groupId}</td>
                <td>{release.memberName || release.personId}</td>
                <td>{release.cycleMonth || "-"}</td>
                <td>{currencyFormatter.format(release.potValue || 0)}</td>
                <td>{currencyFormatter.format(release.discountAmount || 0)}</td>
                <td>{currencyFormatter.format(release.releasedAmount || 0)}</td>
                <td>
                  {currencyFormatter.format(release.dividendPerMember || 0)}
                </td>
                <td>
                  <button
                    className="ghost-button"
                    onClick={() => deleteRelease(release.id)}
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
