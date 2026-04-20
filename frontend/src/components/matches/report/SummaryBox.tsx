import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

/**
 * Renders an AI-generated Markdown summary directly from the master JSON string.
 * Supports a 'smaller' variant for technical/formula boxes.
 * @supports_sans_serif - Now supports sans-serif mode for formulas when smaller=true.
 */
function SummaryBox({ content, smaller = false }: { content?: string; smaller?: boolean }) {
    if (!content) return null;

    const textSize = smaller ? "text-xs print:text-[9px]" : "text-base print:text-xs";
    const fontClass = smaller ? "font-sans" : "font-serif";
    const headerSize = smaller ? "text-base" : "text-xl";
    const subHeaderSize = smaller ? "text-sm" : "text-lg";

    return (
        <div className={cn("mt-4 text-accent-forest", smaller && "mt-1")}>
            <ReactMarkdown
                components={{
                    p: ({ node, ...props }) => <p className={cn(textSize, fontClass, "mb-4 print:mb-2 last:mb-0 leading-relaxed text-accent-forest/80")} {...props} />,
                    ul: ({ node, ...props }) => <ul className={cn("list-outside list-disc pl-6 print:pl-4 mb-4 print:mb-2 space-y-2 print:space-y-1 marker:text-accent-sage", textSize, fontClass, "text-accent-forest/80")} {...props} />,
                    ol: ({ node, ...props }) => <ol className={cn("list-outside list-decimal pl-6 print:pl-4 mb-4 print:mb-2 space-y-2 print:space-y-1 marker:text-accent-sage", textSize, fontClass, "text-accent-forest/80")} {...props} />,
                    li: ({ node, ...props }) => <li className="pl-1 leading-relaxed" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-accent-forest" {...props} />,
                    h1: ({ node, ...props }) => <h1 className={cn("font-serif font-semibold text-accent-forest mb-4 print:mb-2 mt-10 print:mt-5 first:mt-0 print:break-after-avoid", smaller ? "text-lg" : "text-2xl")} {...props} />,
                    h2: ({ node, ...props }) => <h2 className={cn("font-serif font-medium text-accent-forest mb-3 print:mb-1.5 mt-8 print:mt-4 first:mt-0 print:break-after-avoid", headerSize)} {...props} />,
                    h3: ({ node, ...props }) => <h3 className={cn("font-semibold text-accent-forest uppercase tracking-wider mb-3 print:mb-1 mt-6 print:mt-3 first:mt-0 print:break-after-avoid", subHeaderSize)} {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className={cn("border-l-2 border-accent-sage/50 pl-5 print:pl-3 py-1 print:py-0.5 mb-4 print:mb-2 italic", fontClass, textSize, "text-accent-forest/70 bg-accent-sage/5 rounded-r-lg")} {...props} />,
                    code: ({ node, ...props }) => <code className="text-[11px] font-mono bg-black/5 px-1 py-0.5 rounded-sm" {...props} />,
                    pre: ({ node, ...props }) => <pre className="bg-transparent p-0 m-0 overflow-x-auto" {...props} />
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export { SummaryBox };