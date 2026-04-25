import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function buildSyntheticAcroFormPdf() {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();

  const page = doc.addPage([612, 792]);

  const drawLabel = (text, x, y) => {
    page.drawText(text, { x, y, size: 11, font: helvetica, color: rgb(0, 0, 0) });
  };

  drawLabel('First name', 50, 720);
  const firstName = form.createTextField('VeteranFirstName');
  firstName.setMaxLength(40);
  firstName.addToPage(page, { x: 150, y: 715, width: 200, height: 18 });

  drawLabel('Last name', 50, 685);
  const lastName = form.createTextField('VeteranLastName');
  lastName.setMaxLength(80);
  lastName.addToPage(page, { x: 150, y: 680, width: 240, height: 18 });

  drawLabel('Email address', 50, 650);
  const email = form.createTextField('VeteranEmail');
  email.addToPage(page, { x: 150, y: 645, width: 280, height: 18 });

  drawLabel('Phone number', 50, 615);
  const phone = form.createTextField('VeteranPhone');
  phone.addToPage(page, { x: 150, y: 610, width: 200, height: 18 });

  drawLabel('Date of birth', 50, 580);
  const dob = form.createTextField('VeteranDateOfBirth');
  dob.addToPage(page, { x: 150, y: 575, width: 120, height: 18 });

  drawLabel('Are you currently employed?', 50, 545);
  const employed = form.createCheckBox('IsEmployed');
  employed.addToPage(page, { x: 250, y: 545, width: 12, height: 12 });

  drawLabel('Branch of service', 50, 510);
  const branch = form.createRadioGroup('BranchOfService');
  branch.addOptionToPage('Army', page, { x: 200, y: 510, width: 12, height: 12 });
  branch.addOptionToPage('Navy', page, { x: 280, y: 510, width: 12, height: 12 });
  branch.addOptionToPage('Air Force', page, { x: 360, y: 510, width: 12, height: 12 });

  drawLabel('Remarks', 50, 470);
  const remarks = form.createTextField('Remarks');
  remarks.setMaxLength(2000);
  remarks.addToPage(page, { x: 150, y: 410, width: 380, height: 60 });

  return doc.save();
}

export async function buildSyntheticStaticPdf() {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);

  page.drawText('STATIC BENEFITS FORM', {
    x: 50,
    y: 730,
    size: 14,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  page.drawText('1. NAME OF VETERAN', {
    x: 50,
    y: 700,
    size: 11,
    font: helvetica,
    color: rgb(0, 0, 0),
  });
  page.drawText('2. CLAIM FILE NUMBER', {
    x: 50,
    y: 670,
    size: 11,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  return doc.save();
}

export async function buildSyntheticInstructionAndStaticFieldsPdf() {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);

  const draw = (text, y, size = 10) =>
    page.drawText(text, {
      x: 50,
      y,
      size,
      font: helvetica,
      color: rgb(0, 0, 0),
    });

  draw('IMPORTANT: Read the Privacy Act and Respondent Burden information before completing this form.', 730);
  draw('SECTION I - VETERAN INFORMATION', 700, 12);
  draw('1. VETERAN NAME', 670);
  draw('2. SOCIAL SECURITY NUMBER', 640);
  draw('3. VA FILE NUMBER', 610);
  draw('4. DATE OF BIRTH', 580);
  draw('5. MAILING ADDRESS', 550);
  draw('9A. PROVIDER OR FACILITY NAME', 520);
  draw('9B. DATE OF TREATMENT', 490);
  draw('9C. PROVIDER/FACILITY STREET ADDRESS', 460);

  return doc.save();
}

export async function buildSyntheticRepeatedProviderStaticPdf() {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);

  const drawPage = (page, rows) => {
    for (const [text, y] of rows) {
      page.drawText(text, {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0),
      });
    }
  };

  const page1 = doc.addPage([612, 792]);
  drawPage(page1, [
    ['AUTHORIZATION TO DISCLOSE INFORMATION', 730],
    ['1. VETERAN NAME', 700],
    ['2. SOCIAL SECURITY NUMBER', 670],
    ['3. VA FILE NUMBER', 640],
    ['4. DATE OF BIRTH', 610],
    ['9A. PROVIDER OR FACILITY NAME', 560],
    ['9B. DATE OF TREATMENT', 530],
    ['9C. PROVIDER/FACILITY STREET ADDRESS', 500],
  ]);

  const page2 = doc.addPage([612, 792]);
  drawPage(page2, [
    ['11A. PROVIDER OR FACILITY NAME', 730],
    ['11B. DATE OF TREATMENT', 700],
    ['11C. PROVIDER/FACILITY STREET ADDRESS', 670],
  ]);

  return doc.save();
}

export async function buildSyntheticSf180StaticPdf() {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);

  const rows = [
    ['1. NAME USED DURING SERVICE (last, first, full middle)', 730],
    ['2. SOCIAL SECURITY #', 700],
    ['3. DATE OF BIRTH', 670],
    ['4. PLACE OF BIRTH', 640],
    ['6. IS THIS PERSON DECEASED? NO YES - MUST provide Date of Death if veteran is deceased', 610],
    ['7. DID THIS PERSON RETIRE FROM MILITARY SERVICE? NO YES', 580],
    ['2. PURPOSE: (Providing information about the purpose of the request is strictly voluntary; however, it may help to provide the best possible response and may', 550],
    ['2. I am the MILITARY SERVICE MEMBER OR VETERAN identified in Section I am the VETERAN S LEGAL GUARDIAN (MUST submit copy of Court', 520],
    ['4. AUTHORIZATION SIGNATURE: I declare (or certify, verify, or', 490],
  ];

  for (const [text, y] of rows) {
    page.drawText(text, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
  }

  return doc.save();
}
