import React, { useEffect, useState } from 'react';
import { Icons } from '../Shared/Icons';
import { useMedicalReport } from '../Context/MedicalReportContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MedicalReportViewProps {
  onBack: () => void;
}

export const MedicalReportView: React.FC<MedicalReportViewProps> = ({ onBack }) => {
  const { currentReport, timeline, generateLiveReport, isGeneratingReport } = useMedicalReport();
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Generate fresh report on mount if not exists
    if (!currentReport) {
      generateLiveReport();
    }
  }, []);

  const getEventIcon = (type: string) => {
    switch(type) {
      case 'USER_AUDIO': return Icons.Mic;
      case 'AI_INSTRUCTION': return Icons.AI;
      case 'ACTION_LOG': return Icons.Check;
      case 'SYSTEM_ALERT': return Icons.Warning;
      case 'VISUAL_OBSERVATION': return Icons.Camera;
      default: return Icons.Interactive;
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(() => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // --- Header ---
            // Bold Main Title
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('HOSPITAL AMBULANCE', 14, 20);
            
            // Subtitle
            doc.setFontSize(18);
            doc.setFont('helvetica', 'normal');
            doc.text('INCIDENT REPORT', 14, 28);

            // Circle Logo Placeholder (Top Right) mimicking reference "T."
            doc.setFillColor(0, 0, 0); // Black circle
            doc.circle(pageWidth - 25, 20, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('T.', pageWidth - 29, 23);
            
            // Orange Accent Line
            doc.setDrawColor(234, 179, 8); // Orange-500
            doc.setLineWidth(1.5);
            doc.line(0, 36, pageWidth, 36);

            // Dark Bar Header containing company info
            doc.setFillColor(30, 41, 59); // Slate-800
            doc.rect(0, 37, pageWidth, 12, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(200, 200, 200);
            doc.text('[Your Company Email]  |  [Your Company Website]  |  [Your Company Number]', 14, 44.5);

            // Reset Text Color
            doc.setTextColor(0, 0, 0);

            // --- Title Center ---
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(51, 65, 85); // Slate-700
            doc.text('Hospital Ambulance Incident Report', pageWidth / 2, 65, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('[RESQ-AI AUTOMATED SYSTEM]', pageWidth / 2, 72, { align: 'center' });
            
            // Divider
            doc.setDrawColor(226, 232, 240); // Slate-200
            doc.setLineWidth(0.5);
            doc.line(20, 80, pageWidth - 20, 80);

            let currentY = 90;

            // --- I. Incident Details ---
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('I. Incident Details', 14, currentY);
            currentY += 5;

            autoTable(doc, {
            startY: currentY,
            head: [],
            body: [
                ['Date of Incident:', new Date().toLocaleDateString()],
                ['Time of Incident:', new Date().toLocaleTimeString()],
                ['Location:', 'Coordinates Provided via Bridge (GPS)'],
                ['Ambulance Unit Number:', 'RESQ-502 (AI UNIT)'],
                ['Dispatch Number:', `INC-${Math.floor(Date.now() / 1000)}`],
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 4, lineColor: [226, 232, 240] },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 60, textColor: [71, 85, 105] } },
            });
            
            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 15;

            // --- II. Patient Information ---
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('II. Patient Information / Assessment', 14, currentY);
            currentY += 5;

            autoTable(doc, {
            startY: currentY,
            head: [],
            body: [
                ['Patient Name:', 'Unknown Subject (See Photo Attachments)'],
                ['Suspected Condition:', currentReport?.condition || 'Pending Assessment'],
                ['Severity Level:', currentReport?.severity || 'Unknown'],
                ['Consciousness:', currentReport?.vitalsEstimate?.consciousness || 'Observation Required'],
                ['Breathing Status:', currentReport?.vitalsEstimate?.breathing || 'Observation Required'],
                ['Bleeding:', currentReport?.vitalsEstimate?.bleeding || 'Observation Required'],
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 4, lineColor: [226, 232, 240] },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 60, textColor: [71, 85, 105] } },
            });

            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 15;

            // --- III. Incident Description ---
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('III. Incident Description & Summary', 14, currentY);
            currentY += 8;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            
            const summaryText = currentReport?.summary || "No automated summary available. Please refer to audio logs.";
            const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 28);
            doc.text(splitSummary, 14, currentY);
            
            currentY += (splitSummary.length * 5) + 10;

            // --- IV. Actions Taken ---
            // If space is low, add page
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('IV. Actions & Interventions Log', 14, currentY);
            currentY += 5;

            const actions = currentReport?.actionsTaken && currentReport.actionsTaken.length > 0 
            ? currentReport.actionsTaken.map(a => [a])
            : [['No specific medical interventions recorded in automated log.']];

            autoTable(doc, {
            startY: currentY,
            head: [['Action / Intervention Performed']],
            body: actions,
            theme: 'plain',
            headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [250, 250, 250] }
            });

            // Footer
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Page ${i} of ${pageCount}  |  Generated by ResQ-AI`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
            }

            // Save
            doc.save(`ResQ_Incident_Report_${Math.floor(Date.now() / 1000)}.pdf`);
        } catch (e) {
            console.error("PDF Export Failed", e);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setIsExporting(false);
        }
    }, 100); // Slight delay to allow UI state update
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-slide-up">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
           <Icons.Back size={24} className="text-slate-600 dark:text-slate-300" />
        </button>
        <div className="flex flex-col items-center">
           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Incident Record</span>
           <span className="text-sm font-semibold text-slate-900 dark:text-white">#{Math.floor(Date.now() / 1000)}</span>
        </div>
        <button className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full">
           <Icons.Share size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        
        {/* Status Card */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
               <div className="p-3 bg-slate-200 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200">
                 <Icons.Report size={32} />
               </div>
               <div>
                 <h1 className="text-xl font-bold text-slate-900 dark:text-white">Medical Incident Report</h1>
                 <p className="text-sm text-slate-500">Auto-generated via Interactive Session</p>
               </div>
            </div>
            {!isGeneratingReport && (
                <button 
                  onClick={() => generateLiveReport()} 
                  className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  title="Regenerate Analysis"
                >
                    <Icons.Retry size={20} />
                </button>
            )}
          </div>

          {isGeneratingReport ? (
            <div className="p-8 text-center text-slate-500 animate-pulse flex flex-col items-center">
               <Icons.AI size={32} className="mb-2 animate-spin text-blue-500" />
               <span>Generating analysis from timeline...</span>
            </div>
          ) : (
             <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                   <div className="text-xs text-slate-500 uppercase font-bold">Suspected Condition</div>
                   <div className="font-semibold text-slate-900 dark:text-white mt-1">{currentReport?.condition || "Assessment Pending"}</div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                   <div className="text-xs text-slate-500 uppercase font-bold">Severity Level</div>
                   <div className={`font-semibold mt-1 ${
                      currentReport?.severity === 'CRITICAL' ? 'text-red-600' : 
                      currentReport?.severity === 'HIGH' ? 'text-orange-500' : 'text-slate-900 dark:text-white'
                   }`}>{currentReport?.severity || "Pending"}</div>
                </div>
                <div className="col-span-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                   <div className="text-xs text-slate-500 uppercase font-bold mb-1">Clinical Summary</div>
                   <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                     {currentReport?.summary || "No active data available. Start an Interactive Session to build this report."}
                   </p>
                </div>
             </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 grid grid-cols-2 gap-3">
           <button 
             onClick={handleExportPDF} 
             disabled={isExporting || isGeneratingReport}
             className={`p-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95 ${
                 isExporting 
                 ? 'bg-slate-400 text-white cursor-wait' 
                 : 'bg-blue-600 text-white hover:bg-blue-700'
             }`}
           >
             {isExporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Report size={18} />}
             <span>{isExporting ? 'Generating...' : 'Export PDF'}</span>
           </button>
           <button className="p-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-sm flex items-center justify-center space-x-2 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
             <Icons.Share size={18} />
             <span>Secure Link</span>
           </button>
        </div>

        {/* Timeline */}
        <div className="px-6 py-4">
           <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
             <Icons.Timer size={18} className="text-slate-400" />
             <span>Event Timeline</span>
           </h3>
           <div className="space-y-6 border-l-2 border-slate-200 dark:border-slate-800 ml-3 pl-6 relative">
              {timeline.length === 0 && (
                <div className="text-sm text-slate-400 italic">No events logged yet.</div>
              )}
              {timeline.slice().reverse().map((event, idx) => {
                 const Icon = getEventIcon(event.type);
                 return (
                   <div key={idx} className="relative">
                      <div className={`absolute -left-[33px] top-0 w-8 h-8 rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center ${
                         event.type === 'SYSTEM_ALERT' ? 'bg-red-500 text-white' : 
                         event.type === 'ACTION_LOG' ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                         <Icon size={14} />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-xs text-slate-400 font-mono mb-1">{event.timestamp.toLocaleTimeString()}</span>
                         <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{event.description}</p>
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>

      </div>
    </div>
  );
};