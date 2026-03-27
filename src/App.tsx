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
      const state = useStore.getState();
      if (state.projects.length === 0) {
        state.createNewProject();
      } else {
        // 기존 프로젝트가 있다면 가장 최근 프로젝트를 불러옵니다
        await state.loadProjectData(state.projects[0].id);
        const newState = useStore.getState();
        // 불러온 프로젝트에 노드가 아예 없다면 기본 텍스트 박스를 하나 생성합니다.
        if (newState.nodes.length === 0) {
          newState.addNode({
            id: `text-${Date.now()}`,
            type: 'sticky',
            position: { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 },
            data: { text: '' },
          });
        }
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
