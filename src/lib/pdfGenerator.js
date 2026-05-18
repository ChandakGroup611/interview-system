import PDFDocument from 'pdfkit';
import { EVALUATION_CRITERIA } from './projectData';

// Generate PDF report buffer — professional compact executive layout
export async function generatePDFReport(candidateData, sessionData, evaluationData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
        info: {
          Title: `Interview Report - ${candidateData.name}`,
          Author: 'Chandak CMIS — Closing Manager Interview System',
          Subject: 'Interview Evaluation Report',
        },
        autoFirstPage: true,
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const PW = doc.page.width;   // 595
      const ML = 45;               // margin left
      const MR = 45;               // margin right
      const CW = PW - ML - MR;     // content width = 505
      const BOTTOM_LIMIT = doc.page.height - 55; // footer safe zone

      // ---- UTILITY: ensure enough space remains, else add page ----
      const ensureSpace = (neededHeight) => {
        if (doc.y + neededHeight > BOTTOM_LIMIT) {
          doc.addPage();
        }
      };

      // ---- UTILITY: section header (title + score inline, underline, no orphan) ----
      const sectionHeader = (title, reserveBelow = 40) => {
        ensureSpace(20 + reserveBelow);
        doc.fill('#1a1a2e').fontSize(11).font('Helvetica-Bold').text(title, ML, doc.y);
        const lineY = doc.y + 2;
        doc.moveTo(ML, lineY).lineTo(ML + CW, lineY).lineWidth(0.8).stroke('#6c63ff');
        doc.y = lineY + 7;
      };

      // ================================================================
      // HEADER BAND
      // ================================================================
      doc.rect(0, 0, PW, 88).fill('#1a1a2e');

      doc.fill('#ffffff')
        .fontSize(19)
        .font('Helvetica-Bold')
        .text('Interview Evaluation Report', ML, 18, { align: 'center', width: CW });

      doc.fill('#aaaacc')
        .fontSize(8.5)
        .font('Helvetica')
        .text('Chandak CMIS — Closing Manager Interview System', ML, 44, { align: 'center', width: CW });

      doc.fill('#6c63ff')
        .fontSize(7.5)
        .text(`Generated: ${new Date().toLocaleDateString('en-IN', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}`, ML, 60, { align: 'center', width: CW });

      doc.y = 100;

      // ================================================================
      // CANDIDATE DETAILS + OVERALL SCORE — side by side compact block
      // ================================================================
      ensureSpace(80);

      const blockY = doc.y;

      // Left: candidate details
      doc.fill('#1a1a2e').fontSize(9).font('Helvetica-Bold').text('CANDIDATE DETAILS', ML, blockY);
      doc.moveTo(ML, doc.y + 2).lineTo(ML + 240, doc.y + 2).lineWidth(0.6).stroke('#6c63ff');
      doc.y += 7;

      const detailY = doc.y;
      doc.fill('#444444').fontSize(8.5).font('Helvetica-Bold').text('Name', ML, detailY);
      doc.fill('#222222').font('Helvetica').text(candidateData.name, ML + 55, detailY);

      doc.fill('#444444').font('Helvetica-Bold').text('Chandak Mail id', ML, detailY + 13);
      doc.fill('#222222').font('Helvetica').text(candidateData.phone || '', ML + 95, detailY + 13);

      doc.fill('#444444').font('Helvetica-Bold').text('Project', ML, detailY + 26);
      doc.fill('#222222').font('Helvetica').text(sessionData.project_name || 'Chandak CMIS', ML + 55, detailY + 26);

      doc.fill('#444444').font('Helvetica-Bold').text('Session', ML, detailY + 39);
      doc.fill('#222222').font('Helvetica').text(String(sessionData.id).split('-')[0].toUpperCase(), ML + 55, detailY + 39);

      doc.fill('#444444').font('Helvetica-Bold').text('Date', ML, detailY + 52);
      doc.fill('#222222').font('Helvetica').text(new Date(sessionData.created_at).toLocaleDateString('en-IN'), ML + 55, detailY + 52);

      doc.fill('#444444').font('Helvetica-Bold').text('Status', ML, detailY + 65);
      doc.fill('#222222').font('Helvetica').text(String(sessionData.status).toUpperCase(), ML + 55, detailY + 65);

      // Right: overall score box
      const finalScore = evaluationData.final_score || 0;
      const scoreColor = finalScore >= 70 ? '#27ae60' : finalScore >= 50 ? '#f39c12' : '#e74c3c';
      const scoreLabel = finalScore >= 70 ? 'STRONG' : finalScore >= 50 ? 'AVERAGE' : 'NEEDS WORK';

      const boxX = ML + 270;
      const boxY = blockY;
      const boxW = CW - 270;
      const boxH = 90;

      doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill('#f7f7fb');
      doc.fill('#1a1a2e').fontSize(8).font('Helvetica-Bold')
        .text('OVERALL SCORE', boxX, boxY + 10, { align: 'center', width: boxW });
      doc.fill(scoreColor).fontSize(34).font('Helvetica-Bold')
        .text(`${finalScore.toFixed(1)}`, boxX, boxY + 24, { align: 'center', width: boxW });
      doc.fill('#888888').fontSize(7.5).font('Helvetica')
        .text('out of 100', boxX, boxY + 62, { align: 'center', width: boxW });
      doc.fill(scoreColor).fontSize(8).font('Helvetica-Bold')
        .text(scoreLabel, boxX, boxY + 74, { align: 'center', width: boxW });

      doc.y = blockY + boxH + 14;

      // ================================================================
      // SECTION SCORES
      // ================================================================
      sectionHeader('SECTION SCORES', 60);

      const scores = evaluationData.scores || {};

      for (const [key, criteria] of Object.entries(EVALUATION_CRITERIA)) {
        const scoreData = scores[key] || { score: 0, feedback: 'N/A' };
        const sColor = scoreData.score >= 7 ? '#27ae60' : scoreData.score >= 5 ? '#f39c12' : '#e74c3c';
        const feedbackText = scoreData.feedback || '';
        const feedbackH = doc.heightOfString(feedbackText, { width: CW - 10, fontSize: 8 });
        const blockH = 14 + feedbackH + 8;

        ensureSpace(blockH);

        const rowY = doc.y;

        // Title + weight
        doc.fill('#222222').fontSize(9).font('Helvetica-Bold')
          .text(`${criteria.name}`, ML, rowY);

        // Weight subtle
        doc.fill('#999999').fontSize(7.5).font('Helvetica')
          .text(`${criteria.weight}%`, ML + 160, rowY + 1);

        // Score — right aligned
        doc.fill(sColor).fontSize(10).font('Helvetica-Bold')
          .text(`${scoreData.score}/10`, ML + CW - 40, rowY, { width: 40, align: 'right' });

        doc.y = rowY + 13;

        // Feedback
        doc.fill('#555555').fontSize(8).font('Helvetica')
          .text(feedbackText, ML + 8, doc.y, { width: CW - 10 });

        doc.y += feedbackH + 7;

        // Subtle separator
        doc.moveTo(ML, doc.y).lineTo(ML + CW, doc.y).lineWidth(0.3).stroke('#e0e0e0');
        doc.y += 5;
      }

      doc.y += 4;

      // ================================================================
      // OVERALL FEEDBACK
      // ================================================================
      const overallText = evaluationData.overall_feedback || 'No feedback available.';
      const overallH = doc.heightOfString(overallText, { width: CW, fontSize: 8.5 });
      sectionHeader('OVERALL FEEDBACK', overallH + 10);

      doc.fill('#333333').fontSize(8.5).font('Helvetica')
        .text(overallText, ML, doc.y, { width: CW });
      doc.y += overallH + 12;

      // ================================================================
      // STRENGTHS & AREAS FOR IMPROVEMENT — two columns
      // ================================================================
      const strengths = evaluationData.strengths || [];
      const improvements = evaluationData.improvements || [];

      const colW = (CW - 15) / 2;
      const leftX = ML;
      const rightX = ML + colW + 15;

      // Estimate heights
      let lH = 16;
      strengths.forEach(s => { lH += doc.heightOfString(`+ ${s}`, { width: colW - 5, fontSize: 8 }) + 4; });
      let rH = 16;
      improvements.forEach(i => { rH += doc.heightOfString(`- ${i}`, { width: colW - 5, fontSize: 8 }) + 4; });
      const twoColH = Math.max(lH, rH) + 10;

      ensureSpace(twoColH + 20);

      const twoColY = doc.y;

      // Left column header
      doc.fill('#27ae60').fontSize(9).font('Helvetica-Bold').text('STRENGTHS', leftX, twoColY);
      doc.moveTo(leftX, twoColY + 12).lineTo(leftX + colW, twoColY + 12).lineWidth(0.5).stroke('#27ae60');

      let lyy = twoColY + 18;
      strengths.forEach(s => {
        const h = doc.heightOfString(`+ ${s}`, { width: colW - 5, fontSize: 8 });
        doc.fill('#2d7a2d').fontSize(8).font('Helvetica-Bold').text('+', leftX, lyy);
        doc.fill('#333333').font('Helvetica').text(s, leftX + 10, lyy, { width: colW - 15 });
        lyy += h + 4;
      });

      // Right column header
      doc.fill('#e74c3c').fontSize(9).font('Helvetica-Bold').text('AREAS FOR IMPROVEMENT', rightX, twoColY);
      doc.moveTo(rightX, twoColY + 12).lineTo(rightX + colW, twoColY + 12).lineWidth(0.5).stroke('#e74c3c');

      let ryy = twoColY + 18;
      improvements.forEach(i => {
        const h = doc.heightOfString(`- ${i}`, { width: colW - 5, fontSize: 8 });
        doc.fill('#b03030').fontSize(8).font('Helvetica-Bold').text('−', rightX, ryy);
        doc.fill('#333333').font('Helvetica').text(i, rightX + 10, ryy, { width: colW - 15 });
        ryy += h + 4;
      });

      doc.y = twoColY + twoColH;

      // ================================================================
      // FOOTER
      // ================================================================
      const footerY = doc.page.height - 30;
      doc.moveTo(ML, footerY - 6).lineTo(ML + CW, footerY - 6).lineWidth(0.4).stroke('#dddddd');
      doc.fill('#aaaaaa').fontSize(6.5).font('Helvetica')
        .text(
          'This report was generated by Chandak CMIS — AI Closing Manager Interview System. Confidential.',
          ML, footerY, { align: 'center', width: CW }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}