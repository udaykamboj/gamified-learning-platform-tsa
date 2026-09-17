function GeneralWrapperStyled({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 xl:px-8 pt-8 pb-16 md:pt-10 relative" style={{ zIndex: 'var(--z-content)' }}>
      {children}
    </div>
  )
}

export default GeneralWrapperStyled