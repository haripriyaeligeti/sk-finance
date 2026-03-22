import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "../firebase";

const StatementArchive = () => {
  const [documents, setDocuments] = useState([]);
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("Monthly Statement");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = async () => {
    const snapshot = await getDocs(collection(db, "documents"));
    setDocuments(
      snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    );
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const uploadDocument = async () => {
    if (!title.trim() || !month || !selectedFile) {
      alert("Enter title, month, and choose a PDF file.");
      return;
    }

    setIsUploading(true);

    try {
      const filePath = `statements/${month}/${Date.now()}-${selectedFile.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, selectedFile);
      const fileUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "documents"), {
        title: title.trim(),
        month,
        category,
        fileName: selectedFile.name,
        filePath,
        fileUrl,
        uploadedAt: Timestamp.now(),
      });

      setTitle("");
      setMonth("");
      setCategory("Monthly Statement");
      setSelectedFile(null);
      fetchDocuments();
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (documentEntry) => {
    if (documentEntry.filePath) {
      await deleteObject(ref(storage, documentEntry.filePath));
    }

    await deleteDoc(doc(db, "documents", documentEntry.id));
    fetchDocuments();
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Archive</p>
          <h2>Statement PDFs</h2>
        </div>
        <p className="section-note">
          Upload generated statements or legacy Google Sheets exports into
          Firebase Storage and catalog them in Firestore.
        </p>
      </div>

      <div className="form-grid">
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Final Statement - Feb 2026"
          />
        </label>
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="Monthly Statement">Monthly Statement</option>
            <option value="Collection Sheet">Collection Sheet</option>
            <option value="Final Statement">Final Statement</option>
          </select>
        </label>
        <label className="full-width">
          PDF file
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] || null)
            }
          />
        </label>
      </div>

      <div className="action-row">
        <button
          className="primary-button"
          onClick={uploadDocument}
          disabled={isUploading}
        >
          {isUploading ? "Uploading..." : "Upload statement"}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Month</th>
              <th>Category</th>
              <th>File</th>
              <th>Uploaded</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((documentEntry) => (
              <tr key={documentEntry.id}>
                <td>{documentEntry.title}</td>
                <td>{documentEntry.month}</td>
                <td>{documentEntry.category}</td>
                <td>
                  <a
                    href={documentEntry.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {documentEntry.fileName}
                  </a>
                </td>
                <td>
                  {documentEntry.uploadedAt
                    ? documentEntry.uploadedAt.toDate().toLocaleDateString()
                    : "-"}
                </td>
                <td>
                  <button
                    className="ghost-button"
                    onClick={() => deleteDocument(documentEntry)}
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

export default StatementArchive;
