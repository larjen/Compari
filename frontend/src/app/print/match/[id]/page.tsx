"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MatchReportViewer } from "@/components/matches/MatchReportViewer";
import { matchApi } from "@/lib/api/matchApi";
import { useToast } from "@/hooks/useToast";
import { TOAST_TYPES } from "@/lib/constants";

export default function PrintMatchReportPage() {
    const { addToast } = useToast();
    const params = useParams();
    const matchId = params.id as string;
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!matchId) return;

        matchApi.getMatchReportData(Number(matchId), "match_report.json")
            .then((data) => {
                setReportData(data);
            })
            .catch((err) => {
                addToast(TOAST_TYPES.ERROR, "Failed to load report for printing");
            })
            .finally(() => setLoading(false));
    }, [matchId, addToast]);

    if (loading) {
        return <div className="p-10 font-sans text-gray-500">Preparing document for print...</div>;
    }

    if (!reportData) {
        return <div className="p-10 font-sans text-red-500">Failed to load document data.</div>;
    }

    return (
        <div className="absolute inset-0 z-50 bg-white overflow-auto p-12 print:static print:overflow-visible print:p-0 print:block">
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
