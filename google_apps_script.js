/**
 * ============================================================================
 * ระบบบริหารจัดการทุนการศึกษา - Google Apps Script (Code.gs)
 * เชื่อมโยงฐานข้อมูล Google Sheets และจัดเก็บไฟล์แนบใน Google Drive
 * ============================================================================
 * 
 * วิธีติดตั้งใช้งาน:
 * 1. เปิด Google Spreadsheet ใหม่ (หรือเปิดที่มีอยู่แล้ว)
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. ลบโค้ดเดิมทั้งหมด แล้วนำโค้ดในไฟล์นี้ไปวางแทนที่
 * 4. คลิกปุ่ม "บันทึก" (รูปแผ่นดิสก์)
 * 5. คลิกปุ่ม "ทำให้ใช้งานได้" (Deploy) > "รายการทำให้ใช้งานได้ใหม่" (New deployment)
 * 6. เลือกประเภทเป็น "เว็บแอป" (Web app)
 *    - คำอธิบาย: Scholarship Cloud API v1
 *    - ดำเนินการในฐานะ: ตัวฉัน (Me)
 *    - ผู้มีสิทธิ์เข้าถึง: ทุกคน (Anyone)  <--- สำคัญมาก!
 * 7. คลิก "ทำให้ใช้งานได้" (Deploy) และให้สิทธิ์เข้าถึงบัญชี Google
 * 8. คัดลอก "URL ของเว็บแอป" (Web App URL) ที่ลงท้ายด้วย /exec ไปใส่ในระบบทุนการศึกษา
 */

const FOLDER_NAME = "ทุนการศึกษา_เอกสารแนบ";

// ----------------------------------------------------------------------------
// GET Handler - รองรับการทดสอบการเชื่อมต่อ และดึงข้อมูลทั้งหมด
// ----------------------------------------------------------------------------
function doGet(e) {
  try {
    const action = e.parameter.action || "ping";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "ping") {
      return responseJSON({
        status: "success",
        message: "Google Apps Script API พร้อมทำงานเรียลไทม์",
        sheetName: ss.getName(),
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getAll") {
      initSheetsIfNeeded(ss);
      const data = {
        applications: getSheetData(ss, "Applications"),
        recipients: getSheetData(ss, "Recipients"),
        scholarships: getSheetData(ss, "Scholarships"),
        departments: getSheetData(ss, "Departments"),
        officials: getSheetData(ss, "Officials")[0] || null,
        institution: getSheetData(ss, "Institution")[0] || null
      };
      return responseJSON({ status: "success", data: data });
    }

    return responseJSON({ status: "error", message: "Action ไม่ถูกต้อง" });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// POST Handler - รองรับการบันทึกข้อมูล และอัปโหลดไฟล์ไปยัง Google Drive
// ----------------------------------------------------------------------------
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheetsIfNeeded(ss);

    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action || "syncAll";

    // 1. อัปโหลดไฟล์เอกสารแนบไปยัง Google Drive
    if (action === "uploadFile") {
      const folder = getOrCreateFolder(FOLDER_NAME);
      const fileName = body.fileName || ("doc_" + Date.now());
      const mimeType = body.mimeType || "application/pdf";
      const base64Data = body.base64Data;

      if (!base64Data) {
        return responseJSON({ status: "error", message: "ไม่พบข้อมูลไฟล์ base64" });
      }

      // ถอดรหัส base64 และบันทึกไฟล์ลง Google Drive
      const decoded = Utilities.base64Decode(base64Data.split(",")[1] || base64Data);
      const blob = Utilities.newBlob(decoded, mimeType, fileName);
      const file = folder.createFile(blob);

      // กำหนดสิทธิ์ให้ผู้มีลิงก์สามารถดูได้
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return responseJSON({
        status: "success",
        fileId: file.getId(),
        fileName: file.getName(),
        driveUrl: file.getUrl(),
        downloadUrl: file.getDownloadUrl()
      });
    }

    // 2. บันทึกหรืออัปเดตคำขอรับทุน (Application)
    if (action === "saveApplication") {
      const app = body.application;
      if (!app) return responseJSON({ status: "error", message: "ไม่พบข้อมูลคำขอ" });

      const sheet = ss.getSheetByName("Applications");
      const rows = sheet.getDataRange().getValues();
      let rowIndex = -1;

      // ค้นหาแถวเดิมด้วย ID
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(app.id)) {
          rowIndex = i + 1;
          break;
        }
      }

      const rowData = [
        app.id,
        app.year || "",
        app.studentId || "",
        app.studentName || "",
        app.level || "",
        app.major || "",
        app.gpa || "",
        app.phone || "",
        app.scholarshipName || "",
        app.sponsor || "",
        app.amount || 0,
        app.type || "external",
        app.reason || "",
        JSON.stringify(app.docs || []),
        JSON.stringify(app.files || []),
        app.status || "รอดำเนินการ",
        app.appliedAt || new Date().toISOString().split("T")[0],
        JSON.stringify(app.timeline || [])
      ];

      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      return responseJSON({ status: "success", id: app.id });
    }

    // 3. ปรับปรุงผลการพิจารณา (Decision)
    if (action === "updateDecision") {
      const appId = body.appId;
      const status = body.status;
      const timeline = body.timeline;
      const sheet = ss.getSheetByName("Applications");
      const rows = sheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(appId)) {
          sheet.getRange(i + 1, 16).setValue(status); // Status column
          if (timeline) {
            sheet.getRange(i + 1, 18).setValue(JSON.stringify(timeline)); // Timeline column
          }
          break;
        }
      }

      // ถ้าอนุมัติ ให้เพิ่มลง Recipients sheet
      if (status === "อนุมัติแล้ว" && body.recipient) {
        const r = body.recipient;
        const rSheet = ss.getSheetByName("Recipients");
        rSheet.appendRow([
          r.studentId, r.studentName, r.level, r.major,
          r.scholarshipName, r.sponsor, r.amount, r.year, r.type
        ]);
      }

      return responseJSON({ status: "success" });
    }

    // 4. ซิงก์ข้อมูลเต็มรูปแบบ (Full Sync All Tables)
    if (action === "syncAll") {
      if (body.applications) setSheetData(ss, "Applications", body.applications);
      if (body.recipients) setSheetData(ss, "Recipients", body.recipients);
      if (body.scholarships) setSheetData(ss, "Scholarships", body.scholarships);
      if (body.departments) setSheetData(ss, "Departments", body.departments);
      if (body.officials) setSheetData(ss, "Officials", [body.officials]);
      if (body.institution) setSheetData(ss, "Institution", [body.institution]);

      return responseJSON({ status: "success", message: "ซิงก์ข้อมูลลง Google Sheets สำเร็จเรียบร้อยแล้ว" });
    }

    return responseJSON({ status: "error", message: "ไม่รู้จัก Action ที่ระบุ" });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function initSheetsIfNeeded(ss) {
  const schemas = {
    Applications: ["id", "year", "studentId", "studentName", "level", "major", "gpa", "phone", "scholarshipName", "sponsor", "amount", "type", "reason", "docs", "files", "status", "appliedAt", "timeline"],
    Recipients: ["studentId", "studentName", "level", "major", "scholarshipName", "sponsor", "amount", "year", "type"],
    Scholarships: ["id", "scholarshipName", "year", "budget", "type", "sponsor"],
    Departments: ["name", "headName"],
    Officials: ["directorName", "directorRole", "guidanceName", "guidanceRole", "adminName", "adminRole"],
    Institution: ["schoolName", "systemTitle", "affiliation"]
  };

  for (const name in schemas) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(schemas[name]);
      sheet.getRange(1, 1, 1, schemas[name].length).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.setFrozenRows(1);
    }
  }
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0];
  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const item = {};
    for (let j = 0; j < headers.length; j++) {
      let val = rows[i][j];
      if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))) {
        try { val = JSON.parse(val); } catch (e) {}
      }
      item[headers[j]] = val;
    }
    results.push(item);
  }
  return results;
}

function setSheetData(ss, sheetName, dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return;
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowsToInsert = [];

  dataArray.forEach(item => {
    const row = [];
    headers.forEach(h => {
      let v = item[h];
      if (typeof v === "object") v = JSON.stringify(v);
      row.push(v !== undefined ? v : "");
    });
    rowsToInsert.push(row);
  });

  // ล้างข้อมูลแถวเก่าตั้งแต่แถวที่ 2 ลงไป
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  // วางข้อมูลใหม่
  if (rowsToInsert.length > 0) {
    sheet.getRange(2, 1, rowsToInsert.length, headers.length).setValues(rowsToInsert);
  }
}
