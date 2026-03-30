import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import useTablePagination from "../utils/useTablePagination";

const GROUP_MEMBERS_PAGE_SIZE = 10;

const GroupMembersTable = () => {
  const [groupMembers, setGroupMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [people, setPeople] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [personId, setPersonId] = useState("");
  const [shareCount, setShareCount] = useState("1");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
  const [editingGroupMemberId, setEditingGroupMemberId] = useState("");

  const resetForm = () => {
    setEditingGroupMemberId("");
    setGroupId("");
    setPersonId("");
    setShareCount("1");
  };

  const fetchGroupMembers = async () => {
    const [membershipSnapshot, groupsSnapshot, peopleSnapshot] =
      await Promise.all([
        getDocs(collection(db, "groupMembers")),
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "people")),
      ]);

    setGroupMembers(
      membershipSnapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })),
    );
    setGroups(
      groupsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
    setPeople(
      peopleSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
  };

  const addGroupMember = async () => {
    const selectedGroup = groups.find((group) => group.id === groupId);
    const selectedPerson = people.find((person) => person.id === personId);

    if (!selectedGroup || !selectedPerson) {
      alert("Select a valid group and customer.");
      return;
    }

    const alreadyExists = groupMembers.some(
      (member) => member.groupId === groupId && member.personId === personId,
    );

    if (alreadyExists) {
      alert("This customer is already enrolled in the selected group.");
      return;
    }

    const monthlyContribution =
      Number(selectedGroup.monthlyShare || 0) * Number(shareCount || 0);

    await addDoc(collection(db, "groupMembers"), {
      groupId,
      personId,
      groupName: selectedGroup.groupName,
      memberName: [selectedPerson.firstName, selectedPerson.lastName]
        .filter(Boolean)
        .join(" "),
      shareCount: Number(shareCount),
      monthlyContribution,
      joinedAt: Timestamp.now(),
    });
    resetForm();
    fetchGroupMembers();
  };

  const startEditingGroupMember = (member) => {
    setEditingGroupMemberId(member.id);
    setGroupId(member.groupId || "");
    setPersonId(member.personId || "");
    setShareCount(String(member.shareCount || 1));
  };

  const updateGroupMember = async () => {
    const selectedGroup = groups.find((group) => group.id === groupId);
    const selectedPerson = people.find((person) => person.id === personId);

    if (!editingGroupMemberId || !selectedGroup || !selectedPerson) {
      alert("Select a valid group and customer.");
      return;
    }

    const duplicateMember = groupMembers.some(
      (member) =>
        member.groupId === groupId &&
        member.personId === personId &&
        member.id !== editingGroupMemberId,
    );

    if (duplicateMember) {
      alert("This customer is already enrolled in the selected group.");
      return;
    }

    const resolvedShareCount = Math.max(Number(shareCount || 1), 1);

    await updateDoc(doc(db, "groupMembers", editingGroupMemberId), {
      groupId,
      personId,
      groupName: selectedGroup.groupName,
      memberName: [selectedPerson.firstName, selectedPerson.lastName]
        .filter(Boolean)
        .join(" "),
      shareCount: resolvedShareCount,
      monthlyContribution:
        Number(selectedGroup.monthlyShare || 0) * resolvedShareCount,
    });

    resetForm();
    fetchGroupMembers();
  };

  const deleteGroupMember = async (id, memberName) => {
    const shouldDelete = window.confirm(
      `Are you sure you want to delete member ${memberName || ""} from this group?`.trim(),
    );

    if (!shouldDelete) {
      return;
    }

    await deleteDoc(doc(db, "groupMembers", id));
    if (editingGroupMemberId === id) {
      resetForm();
    }
    fetchGroupMembers();
  };

  useEffect(() => {
    fetchGroupMembers();
  }, []);

  const memberLabelsById = useMemo(() => {
    const totalsByGroupAndName = new Map();

    groupMembers.forEach((member) => {
      const baseName = member.memberName || member.personId || "Member";
      const key = `${member.groupId}::${baseName}`;
      totalsByGroupAndName.set(
        key,
        (totalsByGroupAndName.get(key) || 0) +
          Math.max(Number(member.shareCount || 1), 1),
      );
    });

    const sequenceByGroupAndName = new Map();
    const labelMap = new Map();

    groupMembers.forEach((member) => {
      const baseName = member.memberName || member.personId || "Member";
      const key = `${member.groupId}::${baseName}`;
      const totalCount = totalsByGroupAndName.get(key) || 1;
      const shareCount = Math.max(Number(member.shareCount || 1), 1);
      const labels = [];

      for (let index = 0; index < shareCount; index += 1) {
        const nextSequence = (sequenceByGroupAndName.get(key) || 0) + 1;
        sequenceByGroupAndName.set(key, nextSequence);
        labels.push(totalCount > 1 ? `${baseName}-${nextSequence}` : baseName);
      }

      labelMap.set(member.id, labels);
    });

    return labelMap;
  }, [groupMembers]);

  const visibleGroupMembers = groupMembers.filter((member) => {
    const matchesGroup = selectedGroupFilter
      ? member.groupId === selectedGroupFilter
      : true;
    const matchesCustomer = selectedCustomerFilter
      ? member.personId === selectedCustomerFilter
      : true;

    return matchesGroup && matchesCustomer;
  });

  const {
    totalPages,
    currentPageSafe,
    pageStart,
    pageEnd,
    paginatedItems: paginatedGroupMembers,
    setCurrentPage,
  } = useTablePagination(visibleGroupMembers, GROUP_MEMBERS_PAGE_SIZE, [
    selectedGroupFilter,
    selectedCustomerFilter,
  ]);

  const groupMap = new Map(groups.map((group) => [group.id, group]));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Enrollment</p>
          <h2>Group Members</h2>
        </div>
        <p className="section-note">
          Attach customers to groups and store their monthly commitment.
        </p>
      </div>

      <div className="form-grid">
        <label>
          <span className="field-label">
            Group Name<span className="required">*</span>
          </span>
          <select
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
          >
            <option value="">Select Group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.groupName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">
            Customer Name <span className="required">*</span>
          </span>
          <select
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
          >
            <option value="">Select Customer</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {[person.firstName, person.lastName].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Share count
          <input
            type="number"
            min="1"
            value={shareCount}
            onChange={(event) => setShareCount(event.target.value)}
          />
        </label>
      </div>

      <div className="action-row">
        <button
          className="primary-button"
          onClick={editingGroupMemberId ? updateGroupMember : addGroupMember}
        >
          {editingGroupMemberId ? "Update member" : "Enroll member"}
        </button>
        {editingGroupMemberId ? (
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
                    value={selectedGroupFilter}
                    onChange={(event) =>
                      setSelectedGroupFilter(event.target.value)
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
                  <span>Customer</span>
                  <select
                    className="table-header-select"
                    value={selectedCustomerFilter}
                    onChange={(event) =>
                      setSelectedCustomerFilter(event.target.value)
                    }
                  >
                    <option value="">All customers</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {[person.firstName, person.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th>Shares</th>
              <th>Monthly Contribution</th>
              <th>Joined</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroupMembers.map((member) => (
              <tr key={member.id}>
                <td>
                  {groupMap.get(member.groupId)?.groupName ||
                    member.groupName ||
                    member.groupId}
                </td>
                <td>
                  {(
                    memberLabelsById.get(member.id) || [
                      member.memberName || member.personId,
                    ]
                  ).join(", ")}
                </td>
                <td>{member.shareCount || 1}</td>
                <td>
                  {(
                    Number(groupMap.get(member.groupId)?.monthlyShare || 0) *
                    Math.max(Number(member.shareCount || 1), 1)
                  ).toLocaleString("en-IN")}
                </td>
                <td>
                  {member.joinedAt
                    ? member.joinedAt.toDate().toLocaleDateString()
                    : "-"}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="ghost-button"
                      onClick={() => startEditingGroupMember(member)}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        deleteGroupMember(
                          member.id,
                          (
                            memberLabelsById.get(member.id) || [
                              member.memberName || member.personId,
                            ]
                          ).join(", "),
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!paginatedGroupMembers.length ? (
              <tr>
                <td colSpan="6">
                  No group members found for the selected filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <p className="table-pagination-note">
          Showing {pageStart}-{pageEnd} of {visibleGroupMembers.length} group
          members
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

export default GroupMembersTable;
