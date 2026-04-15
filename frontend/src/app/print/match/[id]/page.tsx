"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MatchReportViewer } from "@/components/matches/MatchReportViewer";

export default function PrintMatchReportPage() {
    const params = useParams();
    const matchId = params.id as string;
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!matchId) return;

        // Fetch the unified match_report.json which now acts as our master file
        fetch(`/api/matches/${matchId}/files/match_report.json`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Report not found");
                const data = await res.json();
                setReportData(data);
            })
            .catch((err) => console.error("Failed to load report for printing", err))
            .finally(() => setLoading(false));
    }, [matchId]);

    if (loading) {
        return <div className="p-10 font-sans text-gray-500">Preparing document for print...</div>;
    }

    if (!reportData) {
        return <div className="p-10 font-sans text-red-500">Failed to load document data.</div>;
    }

    return (
        <div className="absolute inset-0 z-50 bg-white overflow-auto p-12 print:static print:overflow-visible print:p-0 print:block">
            {/* The wrapper guarantees a blank slate, overriding any app layouts */}
            <div className="max-w-4xl mx-auto">
                <MatchReportViewer 
                    reportData={reportData} 
                    matchId={Number(matchId)} 
                    isPrintMode={true} 
                />
            </div>
        </div>
    );
}