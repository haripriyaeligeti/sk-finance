import { useEffect, useMemo, useRef, useState } from "react";
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
  const [shareIndex, setShareIndex] = useState("");
  const [cycleMonth, setCycleMonth] = useState("");
  const cycleMonthInputRef = useRef(null);
  const [releasedOn, setReleasedOn] = useState("");
  const [nextCycleAmount, setNextCycleAmount] = useState("");
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

  const groupMap = new Map(groups.map((group) => [group.id, group]));

  const shareLabelsByMembershipId = useMemo(() => {
    const totalsByGroupAndName = new Map();

    memberships.forEach((membership) => {
      const baseName = membership.memberName || membership.personId || "Member";
      const key = `${membership.groupId}::${baseName}`;
      totalsByGroupAndName.set(
        key,
        (totalsByGroupAndName.get(key) || 0) +
          Math.max(Number(membership.shareCount || 1), 1),
      );
    });

    const sequenceByGroupAndName = new Map();
    const labelMap = new Map();

    memberships.forEach((membership) => {
      const baseName = membership.memberName || membership.personId || "Member";
      const key = `${membership.groupId}::${baseName}`;
      const totalCount = totalsByGroupAndName.get(key) || 1;
      const shareCount = Math.max(Number(membership.shareCount || 1), 1);
      const labels = [];

      for (let index = 0; index < shareCount; index += 1) {
        const nextSequence = (sequenceByGroupAndName.get(key) || 0) + 1;
        sequenceByGroupAndName.set(key, nextSequence);
        labels.push({
          shareIndex: index + 1,
          label: totalCount > 1 ? `${baseName}-${nextSequence}` : baseName,
        });
      }

      labelMap.set(membership.id, labels);
    });

    return labelMap;
  }, [memberships]);

  const selectedMembership = memberships.find(
    (membership) => membership.id === groupMemberId,
  );
  const selectedShareOptions =
    shareLabelsByMembershipId.get(groupMemberId) || [];

  const addRelease = async () => {
    const selectedGroup = groups.find((group) => group.id === groupId);
    const selectedShare = selectedShareOptions.find(
      (entry) => String(entry.shareIndex) === shareIndex,
    );

    if (!selectedGroup || !selectedMembership || !cycleMonth || !shareIndex) {
      alert("Select a group, member, share, and cycle month.");
      return;
    }

    const resolvedNextCycleAmount = Number(
      nextCycleAmount || selectedGroup.monthlyShare || 0,
    );

    await addDoc(collection(db, "releases"), {
      groupId,
      groupName: selectedGroup.groupName,
      groupMemberId,
      groupMemberShareKey: `${groupMemberId}-${shareIndex}`,
      shareIndex: Number(shareIndex),
      personId: selectedMembership.personId,
      memberName: selectedShare?.label || selectedMembership.memberName,
      cycleMonth,
      releasedOn,
      nextCycleAmount: resolvedNextCycleAmount,
      notes: notes.trim(),
      createdAt: Timestamp.now(),
    });

    setGroupId("");
    setGroupMemberId("");
    setShareIndex("");
    setCycleMonth("");
    setReleasedOn("");
    setNextCycleAmount("");
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
            onChange={(event) => {
              const nextGroupMemberId = event.target.value;
              const nextMembership = memberships.find(
                (membership) => membership.id === nextGroupMemberId,
              );

              setGroupMemberId(nextGroupMemberId);
              setShareIndex("");
              setNextCycleAmount(
                nextMembership
                  ? String(
                      groupMap.get(nextMembership.groupId)?.monthlyShare || "",
                    )
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
          Share
          <select
            value={shareIndex}
            onChange={(event) => setShareIndex(event.target.value)}
          >
            <option value="">Select share</option>
            {selectedShareOptions.map((share) => (
              <option
                key={`${groupMemberId}-${share.shareIndex}`}
                value={share.shareIndex}
              >
                {share.label}
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
        <label>
          Next cycle amount
          <input
            type="number"
            value={nextCycleAmount}
            onChange={(event) => setNextCycleAmount(event.target.value)}
            placeholder="30"
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
              <th>Next Cycle Amount</th>
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
                <td>{release.nextCycleAmount || "-"}</td>
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
