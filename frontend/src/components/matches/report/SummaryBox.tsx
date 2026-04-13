import ReactMarkdown from 'react-markdown';

/**
 * Renders an AI-generated Markdown summary directly from the master JSON string.
 */
function SummaryBox({ content }: { content?: string }) {
    if (!content) return null;

    return (
        <div className="mt-4 text-accent-forest">
            <ReactMarkdown
                components={{
                    p: ({node, ...props}) => <p className="text-base print:text-xs font-serif mb-4 print:mb-2 last:mb-0 leading-relaxed text-accent-forest/80" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-outside list-disc pl-6 print:pl-4 mb-4 print:mb-2 space-y-2 print:space-y-1 text-base print:text-xs font-serif text-accent-forest/80 marker:text-accent-sage" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-outside list-decimal pl-6 print:pl-4 mb-4 print:mb-2 space-y-2 print:space-y-1 text-base print:text-xs font-serif text-accent-forest/80 marker:text-accent-sage" {...props} />,
                    li: ({node, ...props}) => <li className="pl-1 leading-relaxed" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold text-accent-forest" {...props} />,
                    h1: ({node, ...props}) => <h1 className="text-2xl print:text-lg font-serif font-semibold text-accent-forest mb-4 print:mb-2 mt-10 print:mt-5 first:mt-0 print:break-after-avoid" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl print:text-base font-serif font-medium text-accent-forest mb-3 print:mb-1.5 mt-8 print:mt-4 first:mt-0 print:break-after-avoid" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg print:text-sm font-semibold text-accent-forest uppercase tracking-wider mb-3 print:mb-1 mt-6 print:mt-3 first:mt-0 print:break-after-avoid" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-accent-sage/50 pl-5 print:pl-3 py-1 print:py-0.5 mb-4 print:mb-2 italic font-serif text-base print:text-xs text-accent-forest/70 bg-accent-sage/5 rounded-r-lg" {...props} />
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export { SummaryBox };