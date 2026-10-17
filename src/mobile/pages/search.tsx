import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Check, Circle, Folder, Layers } from 'lucide-react';
import { useService } from '@/hooks/use-service';
import { useWatchEvent } from '@/hooks/use-watch-event';
import { ITodoService } from '@/services/todo/common/todoService';
import { TaskObjectSchema } from '@/core/type';
import { PageLayout } from '../components/PageLayout';

export const MobileSearch = () => {
  const todo = useService(ITodoService);
  useWatchEvent(todo.onStateChange);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const state = todo.modelState;
  const results = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return state.taskList.filter(item => {
      const text = [item.title, 'notes' in item ? item.notes : '', ...('tags' in item ? item.tags : [])].join(' ').toLocaleLowerCase();
      return item.type !== 'projectHeading' && terms.every(term => text.includes(term));
    });
  }, [query, state]);
  const open = (item: TaskObjectSchema) => {
    if (item.type === 'project') { navigate(`/project/${item.uid}`); return; }
    if (item.type === 'area') { navigate(`/area/${item.uid}`); return; }
    if (item.type !== 'task') return;
    if (item.status === 'completed' || item.status === 'canceled') { navigate('/completed'); return; }
    let parent = item.parentId ? state.taskObjectMap.get(item.parentId) : undefined;
    const visited = new Set<string>();
    while (parent && (parent.type === 'task' || parent.type === 'projectHeading')) {
      if (visited.has(parent.id)) return;
      visited.add(parent.id);
      parent = parent.parentId ? state.taskObjectMap.get(parent.parentId) : undefined;
    }
    const route = parent?.type === 'project' ? `/project/${parent.uid}` : parent?.type === 'area' ? `/area/${parent.uid}` : '/inbox';
    // Reuse the upstream task editor after navigating to the task's own workspace.
    todo.editItem(item.id);
    navigate(route);
  };
  return <PageLayout header={{ title: 'Search', showBack: true }}>
    <label className="still-search-input"><Search size={20} aria-hidden="true" />
      <input autoFocus aria-label="Search tasks, projects and areas" placeholder="Find a little clarity…" value={query} onChange={e => setQuery(e.target.value)} />
    </label>
    <p className="still-search-summary" role="status">{query.trim() ? `${results.length} results` : 'Search titles, notes and tags.'}</p>
    <div className="still-search-results">{results.slice(0, 200).map(item => {
      const Icon = item.type === 'project' ? Folder : item.type === 'area' ? Layers : item.type === 'task' && item.status === 'completed' ? Check : Circle;
      return <button type="button" key={item.id} onClick={() => open(item)}>
        <Icon size={18} aria-hidden="true" /><span>{item.title || 'Untitled'}<small>{item.type === 'task' ? item.status : item.type}</small></span>
      </button>;
    })}</div>
    {results.length > 200 && <p className="still-search-summary">Showing the first 200 matches. Add a word to narrow your search.</p>}
  </PageLayout>;
};
