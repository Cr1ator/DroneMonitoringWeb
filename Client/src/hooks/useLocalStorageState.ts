import { useState, useEffect } from "react";

function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const savedItem = localStorage.getItem(key);
      if (savedItem !== null) {
        return JSON.parse(savedItem);
      }
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
    }

    // Если defaultValue - это функция, вызываем ее (для ленивой инициализации)
    return defaultValue instanceof Function ? defaultValue() : defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

export default useLocalStorageState;
