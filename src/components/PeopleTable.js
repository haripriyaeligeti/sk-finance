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
    if (!editingPersonId || !firstName.trim() || !lastName.trim()) {
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

  const deletePerson = async (id) => {
    await deleteDoc(doc(db, "people", id));
    if (editingPersonId === id) {
      resetForm();
    }
    fetchPeople();
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Master Data</p>
          <h2>Customers</h2>
        </div>
        <p className="section-note">
          Maintain customer names once and reuse them across groups.
        </p>
      </div>

      <div className="form-grid">
        <label>
          First name
          <input
            placeholder="Sai"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          Last name
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
            {people.map((person) => (
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
                  <button
                    className="ghost-button"
                    onClick={() => deletePerson(person.id)}
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

export default PeopleTable;
