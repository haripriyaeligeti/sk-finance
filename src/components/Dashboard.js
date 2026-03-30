import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const Dashboard = () => {
  const [summary, setSummary] = useState({
    groups: 0,
    activeGroups: 0,
    people: 0,
    memberships: 0,
    payments: 0,
    releasedAmount: 0,
    documents: 0,
  });

  useEffect(() => {
    const fetchSummary = async () => {
      const [
        groupsSnapshot,
        peopleSnapshot,
        membersSnapshot,
        paymentsSnapshot,
        releasesSnapshot,
        documentsSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, "groups")),
        getDocs(collection(db, "people")),
        getDocs(collection(db, "groupMembers")),
        getDocs(collection(db, "payments")),
        getDocs(collection(db, "releases")),
        getDocs(collection(db, "documents")),
      ]);

      const groups = groupsSnapshot.docs.map((entry) => entry.data());
      const releases = releasesSnapshot.docs.map((entry) => entry.data());

      setSummary({
        groups: groups.length,
        activeGroups: groups.filter((group) => group.status === "Active")
          .length,
        people: peopleSnapshot.size,
        memberships: membersSnapshot.size,
        payments: paymentsSnapshot.size,
        releasedAmount: releases.reduce(
          (total, release) => total + Number(release.releasedAmount || 0),
          0,
        ),
        documents: documentsSnapshot.size,
      });
    };

    fetchSummary();
  }, []);

  return (
    <section className="panel summary-panel">
      <div className="section-heading">
        <div>
          <p className="section-label">Overview</p>
          <h2>Operational snapshot</h2>
        </div>
        <p className="section-note">
          Live totals pulled from Firestore collections.
        </p>
      </div>

      <div className="summary-grid">
        <article className="summary-card accent-sand">
          <span>Groups</span>
          <strong>{summary.groups}</strong>
          <small>{summary.activeGroups} active groups</small>
        </article>
        <article className="summary-card accent-blue">
          <span>Customers</span>
          <strong>{summary.people}</strong>
          <small>{summary.memberships} total memberships</small>
        </article>
        <article className="summary-card accent-green">
          <span>Collections Logged</span>
          <strong>{summary.payments}</strong>
          <small>Month-wise payment entries</small>
        </article>
        <article className="summary-card accent-red">
          <span>Released Amount</span>
          <strong>{currencyFormatter.format(summary.releasedAmount)}</strong>
          <small>{summary.documents} archived statements</small>
        </article>
      </div>
    </section>
  );
};

export default Dashboard;
