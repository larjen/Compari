import Image from 'next/image';

/**
 * Props for the Logo component.
 */
interface LogoProps {
    /** Optional tailwind classes for sizing/spacing */
    className?: string;
    /** Width of the logo in pixels */
    width?: number;
    /** Height of the logo in pixels */
    height?: number;
}

/**
 * Logo component that renders the Compari wordmark from the public directory.
 * * Uses next/image for automatic optimization and layout stability.
 * * @param props - Customization for width, height, and classes
 * @returns A themed Logo component
 */
export function Logo({ className, width = 120, height = 28 }: LogoProps) {
    return (
        <div className={className}>
            <Image
                src="/compari.svg"
                alt="Compari"
                width={width}
                height={height}
                priority // Ensures the logo loads immediately as it's above the fold
            />
        </div>
    );
}