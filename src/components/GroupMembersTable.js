import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const GroupMembersTable = () => {
  const [groupMembers, setGroupMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [people, setPeople] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [personId, setPersonId] = useState("");
  const [shareCount, setShareCount] = useState("1");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");

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
    setGroupId("");
    setPersonId("");
    setShareCount("1");
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
          Customer
          <select
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
          >
            <option value="">Select customer</option>
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
        <button className="primary-button" onClick={addGroupMember}>
          Enroll member
        </button>
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
            {visibleGroupMembers.map((member) => (
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
                </td>
              </tr>
            ))}
            {!visibleGroupMembers.length ? (
              <tr>
                <td colSpan="6">
                  No group members found for the selected filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default GroupMembersTable;
