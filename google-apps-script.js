/**
 * SUNDAY GUELPH VB — Google Apps Script
 * ──────────────────────────────────────
 * Deploy as Web App: Execute as "Me" | Access: Anyone
 *
 * SHEET TABS (auto-created):
 *   Registrations | Pickup Signups | Scores | Teams | Team Players | Schedule | Schedule Games
 *
 * REQUEST TYPES (?type=...):
 *   registration   — write registration row
 *   pickup         — write pick-up signup row
 *   score          — write score row
 *   saveTeams      — overwrite the Teams sheet
 *   saveTeamPlayers— overwrite the Team Players sheet
 *   saveSchedule   — overwrite Schedule + Schedule Games sheets
 *   getData        — read all rows from any sheet as JSON
 *   checkDuplicate — check if email+field exists in a sheet
 */

const SPREADSHEET_ID = '';

function getSpreadsheet() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name, headers) {
  const ss    = getSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const h = sheet.getRange(1, 1, 1, headers.length);
    h.setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#E8A820');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, headers.length, 160);
  }
  return sheet;
}

function clearAndReplace(sheet, headers, rows) {
  sheet.clearContents();
  sheet.appendRow(headers);
  const h = sheet.getRange(1, 1, 1, headers.length);
  h.setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#E8A820');
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ROUTER ────────────────────────────────────────────────────

function doGet(e) {
  const p    = e.parameter || {};
  const type = p.type || '';
  var result;
  try {
    switch (type) {
      case 'registration':    result = handleRegistration(p);    break;
      case 'pickup':          result = handlePickup(p);          break;
      case 'score':           result = handleScore(p);           break;
      case 'saveTeams':       result = handleSaveTeams(p);       break;
      case 'saveTeamPlayers': result = handleSaveTeamPlayers(p); break;
      case 'saveSchedule':    result = handleSaveSchedule(p);    break;
      case 'getData':         result = handleGetData(p);         break;
      case 'checkDuplicate':  result = handleCheckDuplicate(p);  break;
      default: result = { ok: false, error: 'Unknown type: ' + type };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return jsonResponse(result);
}

// ── REGISTRATION ──────────────────────────────────────────────

var REG_HEADERS = [
  'Timestamp','First Name','Last Name','Email','Phone',
  'Position','Skill Level','Season','How Did You Hear','Notes',
  'Waiver Accepted','Contact Consent','Photo Consent','User Agent'
];

function handleRegistration(p) {
  var sheet  = getSheet('Registrations', REG_HEADERS);
  var email  = (p.email  || '').toLowerCase().trim();
  var season = (p.season || '').trim();
  if (email && isDuplicate(sheet, 4, email, 8, season))
    return { ok: false, duplicate: true, message: email + ' is already registered for ' + season };
  sheet.appendRow([
    p.timestamp || new Date().toISOString(),
    p.firstName || '', p.lastName || '', email, p.phone || '',
    p.position  || '', p.skill    || '', season, p.referral || '', p.notes || '',
    p.waiverAccepted === 'true' ? 'YES' : 'NO',
    p.contactConsent === 'true' ? 'YES' : 'NO',
    p.photoConsent   === 'true' ? 'YES' : 'NO',
    p.userAgent || ''
  ]);
  if (email) sendConfirmationEmail(email, p.firstName, 'registration', season);
  return { ok: true };
}

// ── PICKUP ────────────────────────────────────────────────────

var PICKUP_HEADERS = [
  'Timestamp','First Name','Last Name','Email',
  'Session Date','Position','Waiver Accepted','Contact Consent','User Agent'
];

function handlePickup(p) {
  var sheet = getSheet('Pickup Signups', PICKUP_HEADERS);
  var email = (p.email || '').toLowerCase().trim();
  var date  = (p.date  || '').trim();
  if (email && isDuplicate(sheet, 4, email, 5, date))
    return { ok: false, duplicate: true, message: email + ' already signed up for ' + date };
  sheet.appendRow([
    p.timestamp || new Date().toISOString(),
    p.firstName || '', p.lastName || '', email, date, p.position || '',
    p.waiverAccepted === 'true' ? 'YES' : 'NO',
    p.contactConsent === 'true' ? 'YES' : 'NO',
    p.userAgent || ''
  ]);
  if (email) sendConfirmationEmail(email, p.firstName, 'pickup', date);
  return { ok: true };
}

// ── SCORE ─────────────────────────────────────────────────────

function handleScore(p) {
  var sheet = getSheet('Scores', [
    'Timestamp','Game Date','Home Team','Home Score',
    'Away Team','Away Score','Court','Submitted By'
  ]);
  sheet.appendRow([
    p.timestamp || new Date().toISOString(),
    p.gameDate  || '', p.homeTeam  || '', p.homeScore || '',
    p.awayTeam  || '', p.awayScore || '', p.court     || '', p.submitter || ''
  ]);
  return { ok: true };
}

// ── SAVE TEAMS ────────────────────────────────────────────────
// Expects: p.teamsJson = JSON string of [{id,name,color}]

function handleSaveTeams(p) {
  var sheet = getSheet('Teams', ['ID','Name','Color','Updated']);
  var teams = [];
  try { teams = JSON.parse(p.teamsJson || '[]'); } catch(e) { return { ok:false, error:'Bad JSON' }; }
  var now = new Date().toISOString();
  var rows = teams.map(function(t) { return [t.id||'', t.name||'', t.color||'', now]; });
  clearAndReplace(sheet, ['ID','Name','Color','Updated'], rows);
  return { ok: true, count: teams.length };
}

// ── SAVE TEAM PLAYERS ─────────────────────────────────────────
// Expects: p.playersJson = JSON string of [{teamId,teamName,email,firstName,lastName,position,skill}]

function handleSaveTeamPlayers(p) {
  var sheet = getSheet('Team Players', ['Team ID','Team Name','Email','First Name','Last Name','Position','Skill','Updated']);
  var players = [];
  try { players = JSON.parse(p.playersJson || '[]'); } catch(e) { return { ok:false, error:'Bad JSON' }; }
  var now = new Date().toISOString();
  var rows = players.map(function(pl) {
    return [pl.teamId||'', pl.teamName||'', pl.email||'',
            pl.firstName||'', pl.lastName||'', pl.position||'', pl.skill||'', now];
  });
  clearAndReplace(sheet,
    ['Team ID','Team Name','Email','First Name','Last Name','Position','Skill','Updated'], rows);
  return { ok: true, count: players.length };
}

// ── SAVE SCHEDULE ─────────────────────────────────────────────
// Expects: p.weeksJson  = JSON string of [{id,week,date,dateISO}]
//          p.gamesJson  = JSON string of [{weekId,id,time,h,a,court}]

function handleSaveSchedule(p) {
  // Weeks sheet
  var weeksSheet = getSheet('Schedule', ['ID','Week Label','Date Display','Date ISO','Updated']);
  var weeks = [];
  try { weeks = JSON.parse(p.weeksJson || '[]'); } catch(e) {}
  var now = new Date().toISOString();
  var weekRows = weeks.map(function(w) {
    return [w.id||'', w.week||'', w.date||'', w.dateISO||'', now];
  });
  clearAndReplace(weeksSheet, ['ID','Week Label','Date Display','Date ISO','Updated'], weekRows);

  // Games sheet
  var gamesSheet = getSheet('Schedule Games', ['Week ID','Game ID','Time','Home Team','Away Team','Court','Updated']);
  var games = [];
  try { games = JSON.parse(p.gamesJson || '[]'); } catch(e) {}
  var gameRows = games.map(function(g) {
    return [g.weekId||'', g.id||'', g.time||'', g.h||'', g.a||'', g.court||'', now];
  });
  clearAndReplace(gamesSheet,
    ['Week ID','Game ID','Time','Home Team','Away Team','Court','Updated'], gameRows);

  return { ok: true, weeks: weeks.length, games: games.length };
}

// ── GET DATA ──────────────────────────────────────────────────

function handleGetData(p) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(p.sheet || '');
  if (!sheet) return { ok: true, rows: [] };
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, rows: [] };
  var headers = values[0];
  var rows = values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
    return obj;
  });
  return { ok: true, rows: rows };
}

// ── CHECK DUPLICATE ───────────────────────────────────────────

function handleCheckDuplicate(p) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(p.sheet || '');
  if (!sheet) return { ok: true, duplicate: false };
  var emailCol  = parseInt(p.emailCol  || '4');
  var field2Col = parseInt(p.field2Col || '0');
  var email     = (p.email    || '').trim().toLowerCase();
  var field2Val = (p.field2Val || '').trim().toLowerCase();
  return { ok: true, duplicate: isDuplicate(sheet, emailCol, email, field2Col, field2Val) };
}

// ── HELPERS ───────────────────────────────────────────────────

function isDuplicate(sheet, emailCol, email, field2Col, field2Val) {
  var data      = sheet.getDataRange().getValues();
  var emailNorm = email.trim().toLowerCase();
  var f2Norm    = field2Val ? field2Val.trim().toLowerCase() : '';
  for (var r = 1; r < data.length; r++) {
    var rowEmail = String(data[r][emailCol - 1]).trim().toLowerCase();
    if (rowEmail !== emailNorm) continue;
    if (!f2Norm || !field2Col) return true;
    var rowF2 = String(data[r][field2Col - 1]).trim().toLowerCase();
    if (rowF2 === f2Norm) return true;
  }
  return false;
}

function sendConfirmationEmail(email, name, type, detail) {
  try {
    var subject, body;
    if (type === 'registration') {
      subject = 'Registration Confirmed - Sunday Guelph VB';
      body = 'Hi ' + name + ',\n\nThanks for registering!\n\nSeason: ' + detail +
             '\n\nWe\'ll send your team assignment soon.\n\n- Sunday GVB Team\nwww.sundayguelphvb.com';
    } else {
      subject = 'Pick-Up Spot Confirmed - Sunday Guelph VB';
      body = 'Hi ' + name + ',\n\nPick-up spot confirmed for:\n' + detail +
             '\n\nLocation: GCVI Gym, Guelph\n\n- Sunday GVB Team';
    }
    MailApp.sendEmail({ to: email, subject: subject, body: body });
  } catch(err) { console.log('Email error: ' + err.message); }
}
