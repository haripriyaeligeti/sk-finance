import { useEffect, useState } from "react";
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

const PEOPLE_PAGE_SIZE = 10;

const PeopleTable = () => {
  const [people, setPeople] = useState([]);
  const [editingPersonId, setEditingPersonId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const normalizeName = (value) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();

  const resetForm = () => {
    setEditingPersonId("");
    setFirstName("");
    setLastName("");
  };

  const fetchPeople = async () => {
    const snapshot = await getDocs(collection(db, "people"));
    setPeople(
      snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
  };

  const addPerson = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert("Enter first name and last name.");
      return;
    }

    const fullName = normalizeName(
      [firstName, lastName].filter(Boolean).join(" "),
    );
    const duplicatePerson = people.find((person) => {
      const existingName = normalizeName(
        [person.firstName, person.lastName].filter(Boolean).join(" "),
      );
      return existingName === fullName;
    });

    if (duplicatePerson) {
      alert("Customer name already exists.");
      return;
    }

    await addDoc(collection(db, "people"), {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      createdAt: Timestamp.now(),
    });

    resetForm();
    fetchPeople();
  };

  const startEditingPerson = (person) => {
    setEditingPersonId(person.id);
    setFirstName(person.firstName || "");
    setLastName(person.lastName || "");
  };

  const updatePerson = async () => {
    if (!editingPersonId || !firstName.trim()) {
      alert("Enter first name");
      return;
    }

    const fullName = normalizeName(
      [firstName, lastName].filter(Boolean).join(" "),
    );
    const duplicatePerson = people.find((person) => {
      const existingName = normalizeName(
        [person.firstName, person.lastName].filter(Boolean).join(" "),
      );
      return existingName === fullName && person.id !== editingPersonId;
    });

    if (duplicatePerson) {
      alert("Customer name already exists.");
      return;
    }

    await updateDoc(doc(db, "people", editingPersonId), {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });

    resetForm();
    fetchPeople();
  };

  const deletePerson = async (id, personName) => {
    const shouldDelete = window.confirm(
      `Are you sure you want to delete customer ${personName || ""}?`.trim(),
    );

    if (!shouldDelete) {
      return;
    }

    await deleteDoc(doc(db, "people", id));
    if (editingPersonId === id) {
      resetForm();
    }
    fetchPeople();
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const {
    totalPages,
    currentPageSafe,
    pageStart,
    pageEnd,
    paginatedItems: paginatedPeople,
    setCurrentPage,
  } = useTablePagination(people, PEOPLE_PAGE_SIZE);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Customers Data</p>
          <h2>Customers</h2>
        </div>
        <p className="section-note">
          Maintain customer names once and reuse them across groups.
        </p>
      </div>

      <div className="form-grid">
        <label>
          <span className="field-label">
            First Name <span className="required">*</span>
          </span>
          <input
            placeholder="Sai"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Last Name</span>
          <input
            placeholder="Krishna"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
      </div>

      <div className="action-row">
        <button
          className="primary-button"
          onClick={editingPersonId ? updatePerson : addPerson}
        >
          {editingPersonId ? "Update customer" : "Add customer"}
        </button>
        {editingPersonId ? (
          <button className="ghost-button" onClick={resetForm}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPeople.map((person) => (
              <tr key={person.id}>
                <td>
                  <button
                    className="name-button"
                    onClick={() => startEditingPerson(person)}
                  >
                    {[person.firstName, person.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </button>
                </td>
                <td>
                  {person.createdAt
                    ? person.createdAt.toDate().toLocaleDateString()
                    : "-"}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="ghost-button"
                      onClick={() => startEditingPerson(person)}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        deletePerson(
                          person.id,
                          [person.firstName, person.lastName]
                            .filter(Boolean)
                            .join(" "),
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!paginatedPeople.length ? (
              <tr>
                <td colSpan="3">No customers found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <p className="table-pagination-note">
          Showing {pageStart}-{pageEnd} of {people.length} customers
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

export default PeopleTable;
