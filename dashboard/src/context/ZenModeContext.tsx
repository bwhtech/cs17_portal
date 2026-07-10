import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "scratch-zen";

type ZenModeContextType = {
  isZen: boolean;
  setIsZen: (value: boolean) => void;
  toggleZen: () => void;
};

const ZenModeContext = createContext<ZenModeContextType>({
  isZen: false,
  setIsZen: () => {},
  toggleZen: () => {},
});

export function ZenModeProvider({ children }: { children: ReactNode }) {
  const [isZen, setIsZen] = useState(false);

  const toggleZen = useCallback(() => {
    setIsZen((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      return next;
    });
  }, []);

  return (
    <ZenModeContext.Provider value={{ isZen, setIsZen, toggleZen }}>
      {children}
    </ZenModeContext.Provider>
  );
}

export function useZenMode() {
  return useContext(ZenModeContext);
}

export function useZenOnMount() {
  const { setIsZen } = useZenMode();
  useLayoutEffect(() => {
    setIsZen(localStorage.getItem(STORAGE_KEY) !== "off");
    return () => setIsZen(false);
  }, [setIsZen]);
}
