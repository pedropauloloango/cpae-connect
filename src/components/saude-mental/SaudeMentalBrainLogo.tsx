type SaudeMentalBrainLogoProps = {
  className?: string;
};

export function SaudeMentalBrainLogo({ className }: SaudeMentalBrainLogoProps) {
  return (
    <img
      src="/landing/saude-mental-brain-logo.jpg"
      alt="Curso de Saúde Mental na Educação"
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
