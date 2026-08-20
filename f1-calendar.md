---
layout: page
title: F1 Dashboard
permalink: /f1-calendar/
---

Next race, calendar, and current standings — computed in your browser on every visit, no rebuild needed. Calendar times are UK (Europe/London). Standings come live from [Jolpica-F1](https://github.com/jolpica/jolpica-f1), the community successor to the Ergast API.

<div id="f1-next-race">Loading next race…</div>

## Calendar

<div style="overflow-x: auto;">
<table id="f1-upcoming-table">
<thead>
<tr><th>#</th><th>Grand Prix</th><th>Sprint Quali</th><th>Sprint</th><th>Qualifying</th><th>Race</th></tr>
</thead>
<tbody id="f1-upcoming-body"><tr><td colspan="6">Loading…</td></tr></tbody>
</table>
</div>

<details style="margin-top: 0.75em;">
<summary id="f1-past-summary">Past races</summary>
<div style="overflow-x: auto;">
<table id="f1-past-table">
<thead>
<tr><th>#</th><th>Grand Prix</th><th>Sprint Quali</th><th>Sprint</th><th>Qualifying</th><th>Race</th></tr>
</thead>
<tbody id="f1-past-body"></tbody>
</table>
</div>
</details>

Round 16 (Bahrain, relocated to Sepang, Malaysia) is a newer change and less certain than the rest of the calendar — treat it as provisional. Later rounds (from Las Vegas onward) may still shift slightly.

## Standings

<div id="f1-standings-error" style="display:none; color: #b00020;">Couldn't load live standings right now — try refreshing.</div>

<div style="display: flex; gap: 2em; flex-wrap: wrap;">
<div style="overflow-x: auto;">
<h3>Drivers</h3>
<table id="f1-driver-table">
<thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Points</th><th>Wins</th></tr></thead>
<tbody id="f1-driver-body"><tr><td colspan="5">Loading…</td></tr></tbody>
</table>
</div>

<div style="overflow-x: auto;">
<h3>Constructors</h3>
<table id="f1-constructor-table">
<thead><tr><th>Pos</th><th>Team</th><th>Points</th><th>Wins</th></tr></thead>
<tbody id="f1-constructor-body"><tr><td colspan="4">Loading…</td></tr></tbody>
</table>
</div>
</div>

## Stats

<ul id="f1-stats-list"><li>Loading…</li></ul>

<style>
#f1-next-race {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: var(--radius, 10px);
  padding: 0.9em 1.2em;
  margin: 1em 0 1.5em;
  font-size: 1.05em;
}
#f1-upcoming-table tr.next-race {
  background-color: rgba(255, 179, 0, 0.25);
  box-shadow: inset 3px 0 0 0 #ffb300;
}
#f1-upcoming-table tr.next-race td:first-child {
  font-weight: 700;
}
</style>

<script>
(function () {
  var ROUNDS = [
    {n: 1, name: "Australian GP (Melbourne)", sq: "–", sp: "–", q: "7 Mar, 05:00", r: "8 Mar, 04:00", raceISO: "2026-03-08T04:00:00+00:00"},
    {n: 2, name: "Chinese GP (Shanghai)", sq: "13 Mar, 07:30", sp: "14 Mar, 03:00", q: "14 Mar, 07:00", r: "15 Mar, 07:00", raceISO: "2026-03-15T07:00:00+00:00"},
    {n: 3, name: "Japanese GP (Suzuka)", sq: "–", sp: "–", q: "28 Mar, 06:00", r: "29 Mar, 06:00", raceISO: "2026-03-29T06:00:00+01:00"},
    {n: 4, name: "Miami GP", sq: "1 May, 21:30", sp: "2 May, 17:00", q: "2 May, 21:00", r: "3 May, 18:00", raceISO: "2026-05-03T18:00:00+01:00"},
    {n: 5, name: "Canadian GP (Montreal)", sq: "22 May, 21:30", sp: "23 May, 17:00", q: "23 May, 21:00", r: "24 May, 21:00", raceISO: "2026-05-24T21:00:00+01:00"},
    {n: 6, name: "Monaco GP", sq: "–", sp: "–", q: "6 Jun, 15:00", r: "7 Jun, 14:00", raceISO: "2026-06-07T14:00:00+01:00"},
    {n: 7, name: "Spanish GP (Barcelona)", sq: "–", sp: "–", q: "13 Jun, 15:00", r: "14 Jun, 14:00", raceISO: "2026-06-14T14:00:00+01:00"},
    {n: 8, name: "Austrian GP (Spielberg)", sq: "–", sp: "–", q: "27 Jun, 15:00", r: "28 Jun, 14:00", raceISO: "2026-06-28T14:00:00+01:00"},
    {n: 9, name: "British GP (Silverstone)", sq: "3 Jul, 16:30", sp: "4 Jul, 12:00", q: "4 Jul, 16:00", r: "5 Jul, 15:00", raceISO: "2026-07-05T15:00:00+01:00"},
    {n: 10, name: "Belgian GP (Spa)", sq: "–", sp: "–", q: "18 Jul, 15:00", r: "19 Jul, 14:00", raceISO: "2026-07-19T14:00:00+01:00"},
    {n: 11, name: "Hungarian GP (Budapest)", sq: "–", sp: "–", q: "25 Jul, 15:00", r: "26 Jul, 14:00", raceISO: "2026-07-26T14:00:00+01:00"},
    {n: 12, name: "Dutch GP (Zandvoort)", sq: "21 Aug, 15:30", sp: "22 Aug, 11:00", q: "22 Aug, 15:00", r: "23 Aug, 14:00", raceISO: "2026-08-23T14:00:00+01:00"},
    {n: 13, name: "Italian GP (Monza)", sq: "–", sp: "–", q: "5 Sep, 15:00", r: "6 Sep, 14:00", raceISO: "2026-09-06T14:00:00+01:00"},
    {n: 14, name: "Spanish GP (Madrid)", sq: "–", sp: "–", q: "12 Sep, 15:00", r: "13 Sep, 14:00", raceISO: "2026-09-13T14:00:00+01:00"},
    {n: 15, name: "Azerbaijan GP (Baku)", sq: "–", sp: "–", q: "25 Sep, 13:00", r: "26 Sep, 12:00", raceISO: "2026-09-26T12:00:00+01:00"},
    {n: 16, name: "Bahrain GP (Sepang, Malaysia) †", sq: "–", sp: "–", q: "3 Oct, 10:00", r: "4 Oct, 08:00", raceISO: "2026-10-04T08:00:00+01:00"},
    {n: 17, name: "Singapore GP (Marina Bay)", sq: "9 Oct, 13:30", sp: "10 Oct, 10:00", q: "10 Oct, 14:00", r: "11 Oct, 13:00", raceISO: "2026-10-11T13:00:00+01:00"},
    {n: 18, name: "United States GP (Austin)", sq: "–", sp: "–", q: "24 Oct, 22:00", r: "25 Oct, 20:00", raceISO: "2026-10-25T20:00:00+00:00"},
    {n: 19, name: "Mexico City GP", sq: "–", sp: "–", q: "31 Oct, 21:00", r: "1 Nov, 20:00", raceISO: "2026-11-01T20:00:00+00:00"},
    {n: 20, name: "Brazilian GP (Interlagos)", sq: "–", sp: "–", q: "7 Nov, 18:00", r: "8 Nov, 17:00", raceISO: "2026-11-08T17:00:00+00:00"},
    {n: 21, name: "Las Vegas GP", sq: "–", sp: "–", q: "21 Nov, 04:00", r: "22 Nov, 04:00", raceISO: "2026-11-22T04:00:00+00:00"},
    {n: 22, name: "Qatar GP (Lusail)", sq: "–", sp: "–", q: "28 Nov, 18:00", r: "29 Nov, 16:00", raceISO: "2026-11-29T16:00:00+00:00"},
    {n: 23, name: "Abu Dhabi GP (Yas Marina)", sq: "–", sp: "–", q: "5 Dec, 14:00", r: "6 Dec, 13:00", raceISO: "2026-12-06T13:00:00+00:00"}
  ];

  function rowHtml(r) {
    return "<tr data-round=\"" + r.n + "\"><td>" + r.n + "</td><td>" + r.name + "</td><td>" + r.sq + "</td><td>" + r.sp + "</td><td>" + r.q + "</td><td>" + r.r + "</td></tr>";
  }

  var now = new Date();
  var upcoming = ROUNDS.filter(function (r) { return new Date(r.raceISO) > now; });
  var past = ROUNDS.filter(function (r) { return new Date(r.raceISO) <= now; });

  var upcomingBody = document.getElementById("f1-upcoming-body");
  var pastBody = document.getElementById("f1-past-body");
  var nextRaceEl = document.getElementById("f1-next-race");
  var pastSummary = document.getElementById("f1-past-summary");

  pastSummary.textContent = "Past races (" + past.length + ")";

  if (upcoming.length === 0) {
    upcomingBody.innerHTML = "<tr><td colspan=\"6\">Season complete.</td></tr>";
    nextRaceEl.innerHTML = "<strong>Season complete.</strong>";
  } else {
    upcomingBody.innerHTML = upcoming.map(rowHtml).join("");
    upcomingBody.querySelector("tr").classList.add("next-race");
    var next = upcoming[0];
    var days = Math.ceil((new Date(next.raceISO) - now) / 86400000);
    nextRaceEl.innerHTML = "<strong>Next race: " + next.name + "</strong> — race " + next.r + " UK (in " + days + " day" + (days === 1 ? "" : "s") + ")";
  }
  pastBody.innerHTML = past.length ? past.map(rowHtml).join("") : "<tr><td colspan=\"6\">None yet.</td></tr>";

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]; }); }

  fetch("https://api.jolpi.ca/ergast/f1/current/driverstandings/")
    .then(function (res) { if (!res.ok) throw new Error("bad response"); return res.json(); })
    .then(function (data) {
      var drivers = data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
      document.getElementById("f1-driver-body").innerHTML = drivers.map(function (d) {
        return "<tr><td>" + d.position + "</td><td>" + esc(d.Driver.givenName + " " + d.Driver.familyName) + "</td><td>" + esc(d.Constructors[0].name) + "</td><td>" + d.points + "</td><td>" + d.wins + "</td></tr>";
      }).join("");

      return fetch("https://api.jolpi.ca/ergast/f1/current/constructorstandings/")
        .then(function (res) { if (!res.ok) throw new Error("bad response"); return res.json(); })
        .then(function (cdata) {
          var constructors = cdata.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
          document.getElementById("f1-constructor-body").innerHTML = constructors.map(function (c) {
            return "<tr><td>" + c.position + "</td><td>" + esc(c.Constructor.name) + "</td><td>" + c.points + "</td><td>" + c.wins + "</td></tr>";
          }).join("");

          var stats = [];
          var leader = drivers[0], second = drivers[1];
          stats.push("<strong>" + esc(leader.Driver.givenName + " " + leader.Driver.familyName) + "</strong> leads the drivers' championship on " + leader.points + " points, " + (parseInt(leader.points, 10) - parseInt(second.points, 10)) + " ahead of " + esc(second.Driver.givenName + " " + second.Driver.familyName) + ".");

          var mostWinsDriver = drivers.reduce(function (a, b) { return parseInt(b.wins, 10) > parseInt(a.wins, 10) ? b : a; });
          stats.push("<strong>" + esc(mostWinsDriver.Driver.givenName + " " + mostWinsDriver.Driver.familyName) + "</strong> has the most wins this season (" + mostWinsDriver.wins + ").");

          var cLeader = constructors[0], cSecond = constructors[1];
          stats.push("<strong>" + esc(cLeader.Constructor.name) + "</strong> leads the constructors' championship on " + cLeader.points + " points, " + (parseInt(cLeader.points, 10) - parseInt(cSecond.points, 10)) + " ahead of " + esc(cSecond.Constructor.name) + ".");

          var minGap = null, minPair = null;
          for (var i = 0; i < drivers.length - 1; i++) {
            var gap = parseInt(drivers[i].points, 10) - parseInt(drivers[i + 1].points, 10);
            if (minGap === null || gap < minGap) { minGap = gap; minPair = [drivers[i], drivers[i + 1]]; }
          }
          if (minPair) {
            stats.push("Closest fight in the standings: <strong>" + esc(minPair[0].Driver.familyName) + "</strong> vs <strong>" + esc(minPair[1].Driver.familyName) + "</strong>, separated by just " + minGap + " point" + (minGap === 1 ? "" : "s") + ".");
          }

          stats.push(past.length + " of " + ROUNDS.length + " rounds completed this season.");

          document.getElementById("f1-stats-list").innerHTML = stats.map(function (s) { return "<li>" + s + "</li>"; }).join("");
        });
    })
    .catch(function () {
      document.getElementById("f1-standings-error").style.display = "block";
      document.getElementById("f1-driver-body").innerHTML = "<tr><td colspan=\"5\">Unavailable</td></tr>";
      document.getElementById("f1-constructor-body").innerHTML = "<tr><td colspan=\"4\">Unavailable</td></tr>";
      document.getElementById("f1-stats-list").innerHTML = "<li>Unavailable</li>";
    });
})();
</script>

† Provisional — venue relocation not yet as firmly confirmed as the rest of the calendar.
