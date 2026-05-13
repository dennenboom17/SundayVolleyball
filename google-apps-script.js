/**
 * SUNDAY GUELPH VB — Google Apps Script
 * ──────────────────────────────────────
 * Deploy this as a Web App (execute as "Me", access "Anyone") to receive
 * form submissions from the website and write them to separate sheets.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Spreadsheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this entire file, replacing any existing code.
 * 4. Click Deploy > New Deployment > Web App.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Click Deploy. Copy the Web App URL.
 * 6. In index.html, replace the SHEETS_ENDPOINTS values with your Web App URL.
 *    (You can use ONE URL for all three forms — this script handles all types.)
 *
 * SHEET TABS (created automatically on first submission):
 *   - Registrations
 *   - Pickup Signups
 *   - Scores
 */

const SPREADSHEET_ID = ''; // optional: paste your Sheet ID here, or leave blank to use active sheet

function getSheet(name, headers) {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // Style header row
    const hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight('bold').setBackground('#0D1B2A').setFontColor('#E8A820');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  const p = e.parameter;
  const type = p.type || '';
  let result = 'error';

  try {
    if (type === 'registration') {
      result = handleRegistration(p);
    } else if (type === 'pickup') {
      result = handlePickup(p);
    } else if (type === 'score') {
      result = handleScore(p);
    }
  } catch (err) {
    result = 'error: ' + err.message;
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRegistration(p) {
  const sheet = getSheet('Registrations', [
    'Timestamp', 'First Name', 'Last Name', 'Email', 'Phone',
    'Position', 'Skill Level', 'Season', 'How Did You Hear', 'Notes'
  ]);

  sheet.appendRow([
    p.timestamp || new Date().toISOString(),
    p.firstName || '',
    p.lastName  || '',
    p.email     || '',
    p.phone     || '',
    p.position  || '',
    p.skill     || '',
    p.season    || '',
    p.referral  || '',
    p.notes     || ''
  ]);

  // Optional: send confirmation email
  if (p.email) {
    sendConfirmationEmail(p.email, p.firstName, 'registration', p.season);
  }

  return 'ok';
}

function handlePickup(p) {
  const sheet = getSheet('Pickup Signups', [
    'Timestamp', 'First Name', 'Last Name', 'Email', 'Session Date', 'Level'
  ]);

  sheet.appendRow([
    p.timestamp || new Date().toISOString(),
    p.firstName || '',
    p.lastName  || '',
    p.email     || '',
    p.date      || '',
    p.level     || ''
  ]);

  if (p.email) {
    sendConfirmationEmail(p.email, p.firstName, 'pickup', p.date);
  }

  return 'ok';
}

function handleScore(p) {
  const sheet = getSheet('Scores', [
    'Timestamp', 'Game Date', 'Home Team', 'Home Score',
    'Away Team', 'Away Score', 'Court', 'Submitted By'
  ]);

  sheet.appendRow([
    p.timestamp  || new Date().toISOString(),
    p.gameDate   || '',
    p.homeTeam   || '',
    p.homeScore  || '',
    p.awayTeam   || '',
    p.awayScore  || '',
    p.court      || '',
    p.submitter  || ''
  ]);

  return 'ok';
}

function sendConfirmationEmail(email, name, type, detail) {
  try {
    let subject, body;

    if (type === 'registration') {
      subject = `🏐 Registration Confirmed – Sunday Guelph VB`;
      body = `Hi ${name},\n\nThanks for registering for Sunday Guelph Volleyball!\n\nSeason: ${detail}\n\nWe'll be in touch with your team assignment and schedule soon.\n\nSee you on the court!\n— Sunday Guelph VB Team`;
    } else if (type === 'pickup') {
      subject = `✅ Pick-Up Spot Confirmed – Sunday Guelph VB`;
      body = `Hi ${name},\n\nYour pick-up spot is confirmed for:\n${detail}\n\nLocation: GCVI Gym, Guelph\n\nSee you there!\n— Sunday Guelph VB Team`;
    }

    if (subject) {
      MailApp.sendEmail({ to: email, subject, body });
    }
  } catch (err) {
    // Email sending is optional; don't fail the whole request
    console.log('Email error:', err.message);
  }
}
