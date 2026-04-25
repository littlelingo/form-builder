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
