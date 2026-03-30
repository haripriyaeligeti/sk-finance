import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import useTablePagination from "../utils/useTablePagination";

const RELEASES_PAGE_SIZE = 10;

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
  const [selectedReleaseGroupFilter, setSelectedReleaseGroupFilter] =
    useState("");
  const [releaseSearchQuery, setReleaseSearchQuery] = useState("");
  const [editingReleaseId, setEditingReleaseId] = useState("");

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

  const resetForm = () => {
    setEditingReleaseId("");
    setGroupId("");
    setGroupMemberId("");
    setShareIndex("");
    setCycleMonth("");
    setReleasedOn("");
    setNextCycleAmount("");
    setNotes("");
  };

  const filteredReleases = useMemo(() => {
    const normalizedQuery = releaseSearchQuery.trim().toLowerCase();

    return releases.filter((release) => {
      const matchesGroup = selectedReleaseGroupFilter
        ? release.groupId === selectedReleaseGroupFilter
        : true;
      const matchesQuery = normalizedQuery
        ? [
            release.groupName,
            release.groupId,
            release.memberName,
            release.personId,
            release.cycleMonth,
            release.releasedOn,
            String(release.nextCycleAmount || ""),
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(normalizedQuery),
            )
        : true;

      return matchesGroup && matchesQuery;
    });
  }, [releases, selectedReleaseGroupFilter, releaseSearchQuery]);

  const {
    totalPages,
    currentPageSafe,
    pageStart,
    pageEnd,
    paginatedItems: paginatedReleases,
    setCurrentPage,
  } = useTablePagination(filteredReleases, RELEASES_PAGE_SIZE, [
    selectedReleaseGroupFilter,
    releaseSearchQuery,
  ]);

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

    resetForm();
    fetchReleases();
  };

  const startEditingRelease = (release) => {
    setEditingReleaseId(release.id);
    setGroupId(release.groupId || "");
    setGroupMemberId(release.groupMemberId || "");
    setShareIndex(
      release.shareIndex === undefined ? "" : String(release.shareIndex),
    );
    setCycleMonth(release.cycleMonth || "");
    setReleasedOn(release.releasedOn || "");
    setNextCycleAmount(
      release.nextCycleAmount === undefined
        ? ""
        : String(release.nextCycleAmount),
    );
    setNotes(release.notes || "");
  };

  const updateRelease = async () => {
    const selectedGroup = groups.find((group) => group.id === groupId);
    const selectedShare = selectedShareOptions.find(
      (entry) => String(entry.shareIndex) === shareIndex,
    );

    if (!editingReleaseId || !selectedGroup || !selectedMembership) {
      alert("Select a group and member.");
      return;
    }

    if (!cycleMonth || !shareIndex) {
      alert("Select a share and cycle month.");
      return;
    }

    const resolvedNextCycleAmount = Number(
      nextCycleAmount || selectedGroup.monthlyShare || 0,
    );

    await updateDoc(doc(db, "releases", editingReleaseId), {
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
    });

    resetForm();
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
    if (editingReleaseId === id) {
      resetForm();
    }
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
        <button
          className="primary-button"
          onClick={editingReleaseId ? updateRelease : addRelease}
        >
          {editingReleaseId ? "Update release" : "Add release"}
        </button>
        {editingReleaseId ? (
          <button className="ghost-button" onClick={resetForm}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <div className="table-header-filter">
                  <span>Group</span>
                  <select
                    className="table-header-select"
                    value={selectedReleaseGroupFilter}
                    onChange={(event) =>
                      setSelectedReleaseGroupFilter(event.target.value)
                    }
                  >
                    <option value="">All groups</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.groupName}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th>
                <div className="table-header-filter">
                  <span>Customer Name</span>
                  <input
                    className="table-header-input"
                    value={releaseSearchQuery}
                    onChange={(event) =>
                      setReleaseSearchQuery(event.target.value)
                    }
                    placeholder="Enter Customer Name"
                  />
                </div>
              </th>
              <th>Next Cycle Amount</th>
              <th>Cycle</th>
              <th>Released on</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedReleases.map((release) => (
              <tr key={release.id}>
                <td>{release.groupName || release.groupId}</td>
                <td>{release.memberName || release.personId}</td>
                <td>{release.nextCycleAmount || "-"}</td>
                <td>{release.cycleMonth || "-"}</td>
                <td>{release.releasedOn || "-"}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="ghost-button"
                      onClick={() => startEditingRelease(release)}
                    >
                      Edit
                    </button>
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
                  </div>
                </td>
              </tr>
            ))}
            {!paginatedReleases.length ? (
              <tr>
                <td colSpan="6">No releases found for the selected filter.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <p className="table-pagination-note">
          Showing {pageStart}-{pageEnd} of {filteredReleases.length} releases
        </p>
        <div className="table-pagination-actions">
          <button
            className="ghost-button compact-button"
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            disabled={currentPageSafe === 1}
          >
            Previous
          </button>
          <span className="table-pagination-page">
            Page {currentPageSafe} of {totalPages}
          </span>
          <button
            className="ghost-button compact-button"
            onClick={() =>
              setCurrentPage((page) => Math.min(page + 1, totalPages))
            }
            disabled={currentPageSafe === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReleasesTable;
