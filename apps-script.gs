/**
 * Backend for Survey.html — Google Apps Script bound to a Google Sheet.
 *
 * Endpoints (single doPost, routed by `action` field in JSON body):
 *   action: "partial"  → upsert row by session_id, is_complete=false
 *   action: "submit"   → upsert row by session_id, is_complete=true
 *
 * Deploy:
 *   1. Create a new Google Sheet. Note its ID from the URL (between /d/ and /edit).
 *   2. Open Extensions → Apps Script. Paste this file. Replace SHEET_ID below.
 *   3. Run setupSheet() once from the Apps Script editor (authorise when prompted).
 *      It creates the "responses" sheet and writes the header row.
 *   4. Deploy → New deployment → Type: Web app.
 *      Execute as: Me. Who has access: Anyone (required so the survey can POST without auth).
 *   5. Copy the /exec URL from the deployment dialog.
 *   6. Open Survey.html and replace the __APPS_SCRIPT_URL__ placeholder near the top of <script> with that URL.
 *
 * The survey POSTs JSON as text/plain (to avoid CORS preflight). doPost reads the body,
 * parses it, and upserts. Partial saves fire on every screen advance; the final submit
 * flips is_complete to true.
 */

var SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
var SHEET_NAME = 'responses';

var COLUMNS = [
  'session_id',
  'started_at_iso',
  'submitted_at_iso',
  'updated_at_iso',
  'is_complete',
  'current_screen',
  'q1_role',
  'q3_post_freq',
  'q4_reasons_json',
  'q4_other',
  'q5_unanchored_price',
  'q_trust',
  'q6_gut_reaction',
  'q7_excites',
  'q8_worries',
  'q9_too_expensive',
  'q10_expensive',
  'q11_good_deal',
  'q12_too_cheap',
  'q13_pricing_model',
  'q14_why',
  'q8b_worries_post',
  'q15_specific_reel',
  'q17_six_month_failure',
  'q18_business_failure',
  'q21_wish_asked',
  'q19_deposit',
  'q20_whatsapp',
  'q20_email',
  'total_session_ms',
  'back_count',
  'screen_times_json',
  'answer_changed_json',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'referrer',
  'device',
  'viewport_w'
];

function setupSheet(){
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
}

function doPost(e){
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch(_) { return jsonOut({ ok: false, error: 'lock_timeout' }); }
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    if (!body || !body.session_id) return jsonOut({ ok: false, error: 'missing_session_id' });

    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return jsonOut({ ok: false, error: 'sheet_not_found' });

    var row = rowFromBody(body);
    var idCol = COLUMNS.indexOf('session_id') + 1;
    var lastRow = sheet.getLastRow();
    var existingRow = -1;
    if (lastRow >= 2){
      var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++){
        if (ids[i][0] === body.session_id){ existingRow = i + 2; break; }
      }
    }
    if (existingRow > 0){
      sheet.getRange(existingRow, 1, 1, COLUMNS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return jsonOut({ ok: true });
  } catch(err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch(_){}
  }
}

function doGet(){
  return ContentService.createTextOutput('Survey backend is alive.').setMimeType(ContentService.MimeType.TEXT);
}

function rowFromBody(b){
  var a = b.answers || {};
  var st = b.screen_times_ms || {};
  var ac = b.answer_changed || {};
  var utm = b.utm || {};
  var nowIso = new Date().toISOString();

  function joinArr(v){ return Array.isArray(v) ? v.join('|') : (v == null ? '' : String(v)); }

  return [
    b.session_id,
    b.started_at_iso || '',
    b.submitted_at_iso || '',
    nowIso,
    !!b.is_complete,
    typeof b.current_screen === 'number' ? b.current_screen : '',
    a.q1 || '',
    a.q3 || '',
    JSON.stringify(a.q4 || []),
    a.q4_other || '',
    a.q5 || '',
    a.q_trust == null ? '' : a.q_trust,
    a.q6 == null ? '' : a.q6,
    a.q7 || '',
    a.q8 || '',
    a.q9 || '',
    a.q10 || '',
    a.q11 || '',
    a.q12 || '',
    a.q13 || '',
    a.q14 || '',
    a.q8b || '',
    a.q15 || '',
    a.q17 || '',
    a.q18 || '',
    a.q21 || '',
    a.q19 || '',
    a.q20_whatsapp || '',
    a.q20_email || '',
    typeof b.total_session_ms === 'number' ? b.total_session_ms : '',
    typeof b.back_count === 'number' ? b.back_count : 0,
    JSON.stringify(st),
    JSON.stringify(ac),
    utm.utm_source || '',
    utm.utm_medium || '',
    utm.utm_campaign || '',
    utm.utm_term || '',
    utm.utm_content || '',
    b.referrer || '',
    b.device || '',
    b.viewport_w || ''
  ];
}

function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
