const PersonaSpotlight = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Clean Studio Background */}
      <div className="absolute inset-0 bg-[#0A0A0A]" />
      
      {/* Subtle Depth Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 via-transparent to-transparent opacity-40" />
      
      {/* Top Ambient Light */}
      <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-white/[0.03] to-transparent" />

      {/* Modern Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

      {/* Digital Grid - Very subtle */}
      <div className="absolute inset-0 opacity-[0.02]" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '100px 100px'
        }} 
      />
    </div>
  );
};

export default PersonaSpotlight;
