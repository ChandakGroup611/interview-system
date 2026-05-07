import PDFDocument from 'pdfkit';
import { EVALUATION_CRITERIA } from './projectData';

// Generate PDF report buffer
export async function generatePDFReport(candidateData, sessionData, evaluationData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Interview Report - ${candidateData.name}`,
          Author: 'AI Real Estate Closing Manager Interview System',
          Subject: 'Interview Evaluation Report',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ---- HEADER ----
      doc.rect(0, 0, doc.page.width, 120).fill('#1a1a2e');
      doc.fill('#ffffff')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Interview Evaluation Report', 50, 35, { align: 'center' });
      doc.fontSize(12)
        .font('Helvetica')
        .text('AI Real Estate Closing Manager Interview System', 50, 70, { align: 'center' });
      doc.fill('#6c63ff')
        .fontSize(10)
        .text(`Generated: ${new Date().toLocaleDateString('en-IN', { 
          year: 'numeric', month: 'long', day: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        })}`, 50, 90, { align: 'center' });

      doc.moveDown(3);

      // ---- CANDIDATE DETAILS ----
      doc.fill('#1a1a2e').fontSize(16).font('Helvetica-Bold').text('Candidate Details', 50);
      doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke('#6c63ff');
      doc.moveDown(0.5);

      doc.fill('#333333').fontSize(11).font('Helvetica');
      doc.text(`Name: ${candidateData.name}`, 50);
      doc.text(`Phone: ${candidateData.phone}`, 50);
      doc.text(`Project: ${sessionData.project_name || 'Chandak CMIS'}`, 50);
      doc.text(`Session ID: ${sessionData.id}`, 50);
      doc.text(`Date: ${new Date(sessionData.created_at).toLocaleDateString('en-IN')}`, 50);
      doc.text(`Status: ${sessionData.status}`, 50);
      doc.moveDown(1);

      // ---- FINAL SCORE ----
      const finalScore = evaluationData.final_score || 0;
      const scoreColor = finalScore >= 70 ? '#27ae60' : finalScore >= 50 ? '#f39c12' : '#e74c3c';
      
      doc.fill('#1a1a2e').fontSize(16).font('Helvetica-Bold').text('Overall Score', 50);
      doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke('#6c63ff');
      doc.moveDown(0.5);

      doc.fill(scoreColor).fontSize(36).font('Helvetica-Bold')
        .text(`${finalScore.toFixed(1)} / 100`, 50, doc.y, { align: 'center' });
      doc.moveDown(1);

      // ---- SECTION SCORES ----
      doc.fill('#1a1a2e').fontSize(16).font('Helvetica-Bold').text('Section Scores', 50);
      doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke('#6c63ff');
      doc.moveDown(0.5);

      const scores = evaluationData.scores || {};
      for (const [key, criteria] of Object.entries(EVALUATION_CRITERIA)) {
        const scoreData = scores[key] || { score: 0, feedback: 'N/A' };
        const sColor = scoreData.score >= 7 ? '#27ae60' : scoreData.score >= 5 ? '#f39c12' : '#e74c3c';
        
        doc.fill('#333333').fontSize(11).font('Helvetica-Bold')
          .text(`${criteria.name} (Weight: ${criteria.weight}%)`, 50, doc.y);
        doc.fill(sColor).font('Helvetica-Bold')
          .text(`${scoreData.score}/10`, 480, doc.y - 13);
        doc.fill('#666666').fontSize(9).font('Helvetica')
          .text(scoreData.feedback || '', 70, doc.y + 2, { width: 400 });
        doc.moveDown(0.5);
      }
      doc.moveDown(0.5);

      // ---- OVERALL FEEDBACK ----
      doc.fill('#1a1a2e').fontSize(16).font('Helvetica-Bold').text('Overall Feedback', 50);
      doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke('#6c63ff');
      doc.moveDown(0.5);
      doc.fill('#333333').fontSize(10).font('Helvetica')
        .text(evaluationData.overall_feedback || 'No feedback available.', 50, doc.y, { width: 495 });
      doc.moveDown(1);

      // ---- STRENGTHS & IMPROVEMENTS ----
      if (evaluationData.strengths && evaluationData.strengths.length > 0) {
        doc.fill('#1a1a2e').fontSize(14).font('Helvetica-Bold').text('Strengths', 50);
        doc.moveDown(0.3);
        evaluationData.strengths.forEach(s => {
          doc.fill('#27ae60').fontSize(10).font('Helvetica').text(`✓ ${s}`, 60, doc.y, { width: 480 });
        });
        doc.moveDown(0.5);
      }

      if (evaluationData.improvements && evaluationData.improvements.length > 0) {
        doc.fill('#1a1a2e').fontSize(14).font('Helvetica-Bold').text('Areas for Improvement', 50);
        doc.moveDown(0.3);
        evaluationData.improvements.forEach(i => {
          doc.fill('#e74c3c').fontSize(10).font('Helvetica').text(`✗ ${i}`, 60, doc.y, { width: 480 });
        });
        doc.moveDown(0.5);
      }

      // ---- PERSONA TRANSITIONS ----
      const transitions = sessionData.persona_transitions || [];
      if (transitions.length > 0) {
        doc.addPage();
        doc.fill('#1a1a2e').fontSize(16).font('Helvetica-Bold').text('Persona Transitions', 50);
        doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke('#6c63ff');
        doc.moveDown(0.5);
        
        transitions.forEach((t, idx) => {
          doc.fill('#333333').fontSize(10).font('Helvetica')
            .text(`Q${t.question || idx + 1}: ${t.from || 'N/A'} → ${t.to || 'N/A'} (${t.reason || 'N/A'})`, 60, doc.y, { width: 480 });
        });
        doc.moveDown(1);
      }

      // ---- FULL TRANSCRIPT ----
      doc.addPage();
      doc.fill('#1a1a2e').fontSize(16).font('Helvetica-Bold').text('Full Interview Transcript', 50);
      doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke('#6c63ff');
      doc.moveDown(0.5);

      const transcript = sessionData.transcript || [];
      transcript.forEach((entry) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }
        
        const isAI = entry.role === 'ai';
        const label = isAI ? '🤖 Customer (AI)' : '👤 Closing Manager';
        const color = isAI ? '#6c63ff' : '#333333';
        
        doc.fill(color).fontSize(10).font('Helvetica-Bold').text(label, 50, doc.y);
        doc.fill('#444444').fontSize(9).font('Helvetica')
          .text(entry.content, 70, doc.y + 2, { width: 470 });
        doc.moveDown(0.8);
      });

      // ---- FOOTER ----
      doc.fill('#999999').fontSize(8).font('Helvetica')
        .text('This report was generated by the AI Real Estate Closing Manager Interview System.', 
          50, doc.page.height - 40, { align: 'center', width: 495 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
