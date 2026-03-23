import { useState } from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";
import GroupMembersTable from "./components/GroupMembersTable";
import Groups from "./components/Groups";
import MonthlyCollectionStatementBuilder from "./components/MonthlyCollectionStatementBuilder";
import PaymentsTable from "./components/PaymentsTable";
import PeopleTable from "./components/PeopleTable";
import ReleasesTable from "./components/ReleasesTable";

const pageItems = [
  {
    id: "home",
    label: "Homepage",
    title: "Chit Finance Homepage",
    description:
      "Track your collections, group capacity, and monthly statement workflow from one place.",
  },
  {
    id: "groups",
    label: "Chit Groups",
    title: "Chit Groups",
    description:
      "Create, update, and monitor chit schemes with share capacity and schedule details.",
  },
  {
    id: "customers",
    label: "Customers",
    title: "Customers",
    description:
      "Maintain customer records once and reuse them across multiple chit groups.",
  },
  {
    id: "members",
    label: "Group Members",
    title: "Group Members",
    description:
      "Enroll customers into groups and manage their share count and monthly commitments.",
  },
  {
    id: "payments",
    label: "Monthly Payments",
    title: "Monthly Payments",
    description:
      "Capture month-wise collections and payment status for each enrolled member.",
  },
  {
    id: "releases",
    label: "Releases",
    title: "Releases",
    description: "Released amount and dividend details.",
  },
  {
    id: "statements",
    label: "Monthly Collecetion Statements",
    title: "View / Edit / Download Monthly Collecetion Statement",
    description:
      "Use one month-wise sheet to review members, update payment details inline, and download the final statement PDF.",
  },
];

function App() {
  const [activePage, setActivePage] = useState("home");

  const activeItem =
    pageItems.find((pageItem) => pageItem.id === activePage) || pageItems[0];

  const renderPage = () => {
    switch (activePage) {
      case "groups":
        return <Groups />;
      case "customers":
        return <PeopleTable />;
      case "members":
        return <GroupMembersTable />;
      case "payments":
        return <PaymentsTable />;
      case "releases":
        return <ReleasesTable />;
      case "statements":
        return <MonthlyCollectionStatementBuilder />;
      case "home":
      default:
        return (
          <div className="home-layout">
            <section className="panel landing-panel">
              <div className="landing-copy">
                <p className="eyebrow">Sai Krishna Finance</p>
                <h1>
                  Run monthly chit operations from one structured workspace.
                </h1>
                <p className="hero-text">
                  Move away from one long manual spreadsheet flow. Manage
                  groups, customers, enrollments, monthly collections, releases,
                  and downloadable statements with separate pages.
                </p>
              </div>

              <div className="home-shortcuts">
                {pageItems
                  .filter((pageItem) => pageItem.id !== "home")
                  .map((pageItem) => (
                    <button
                      key={pageItem.id}
                      className="shortcut-card"
                      onClick={() => setActivePage(pageItem.id)}
                    >
                      <strong>{pageItem.label}</strong>
                      <span>{pageItem.description}</span>
                    </button>
                  ))}
              </div>
            </section>
            <Dashboard />
          </div>
        );
    }
  };

  return (
    <div className="App app-frame">
      <aside className="sidebar-shell">
        <div className="sidebar-brand panel">
          <p className="eyebrow">Sai Krishna</p>
          <h2>Finance</h2>
        </div>

        <nav className="sidebar-nav panel" aria-label="Main navigation">
          {pageItems.map((pageItem) => (
            <button
              key={pageItem.id}
              className={`nav-item ${activePage === pageItem.id ? "active" : ""}`}
              onClick={() => setActivePage(pageItem.id)}
            >
              <span className="nav-item-title">{pageItem.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content-shell">
        <header className="page-header panel">
          <div>
            <p className="section-label">Workspace</p>
            <h1 className="page-title">{activeItem.title}</h1>
          </div>
          <p className="page-description">{activeItem.description}</p>
        </header>

        <section className="page-body">{renderPage()}</section>
      </main>
    </div>
  );
}

export default App;
