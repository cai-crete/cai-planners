/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import Canvas from './components/Canvas';
import { useStore } from './store/useStore';
import { Sun, Moon } from 'lucide-react';

export default function App() {
  const { loadProjectsList, projects, createNewProject, toggleRightPanel } = useStore();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const init = async () => {
      await loadProjectsList();
      if (useStore.getState().projects.length === 0) {
        createNewProject();
      }
    };
    init();
  }, [loadProjectsList, createNewProject]);

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900 transition-colors dark:bg-neutral-950 dark:text-neutral-50">
      <Canvas />
    </div>
  );
}
