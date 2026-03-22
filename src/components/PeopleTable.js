import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const PeopleTable = () => {
  const [people, setPeople] = useState([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const fetchPeople = async () => {
    const snapshot = await getDocs(collection(db, "people"));
    setPeople(
      snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
  };

  const addPerson = async () => {
    if (!firstName.trim() || !phone.trim()) {
      alert("Enter at least first name and phone number.");
      return;
    }

    await addDoc(collection(db, "people"), {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      createdAt: Timestamp.now(),
    });
    setFirstName("");
    setLastName("");
    setPhone("");
    setAddress("");
    fetchPeople();
  };

  const deletePerson = async (id) => {
    await deleteDoc(doc(db, "people", id));
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
          Maintain customer contact details once and reuse them across groups.
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
        <label>
          Phone
          <input
            placeholder="9876543210"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="full-width">
          Address
          <input
            placeholder="Town, area, landmark"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={addPerson}>
          Add customer
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>
                  {[person.firstName, person.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </td>
                <td>{person.phone || "-"}</td>
                <td>{person.address || "-"}</td>
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
