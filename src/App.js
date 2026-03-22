import "./App.css";
import Dashboard from "./components/Dashboard";
import GroupMembersTable from "./components/GroupMembersTable";
import Groups from "./components/Groups";
import PaymentsTable from "./components/PaymentsTable";
import PeopleTable from "./components/PeopleTable";
import ReleasesTable from "./components/ReleasesTable";
import StatementArchive from "./components/StatementArchive";
import StatementBuilder from "./components/StatementBuilder";

function App() {
  return (
    <div className="App">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sai Krishna Chit Finance</p>
          <h1>
            Manage chit groups, monthly collections, releases, and statements in
            one place...
          </h1>
          <p className="hero-text">
            This replaces the manual spreadsheet cycle with Firestore-backed
            master data, month-wise collections, prize release tracking, and PDF
            statement storage.
          </p>
        </div>
      </header>

      <main className="app-shell">
        <Dashboard />
        <div className="workspace-grid">
          <Groups />
          <PeopleTable />
          <GroupMembersTable />
          <PaymentsTable />
          <ReleasesTable />
          <StatementBuilder />
          <StatementArchive />
        </div>
      </main>
    </div>
  );
}

export default App;
