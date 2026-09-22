import { supabase } from './lib/supabase';

export type Advice = {
  id: string;
  text: string;
  author: string;
  votes: number;
  mine?: boolean;
  reported?: boolean;
};

export type Situation = {
  id: string;
  title: string;
  context: string;
  tag: string;
  author: string;
  time: string;
  advice: Advice[];
  hot: number;
};

export type Profile = {
  name: string;
  handle: string;
  points: number;
  avatar: string;
  joined: string;
  email?: string;
};

type DbProfileRow = {
  username: string;
  points: number;
  created_at: string;
};

function toHandle(username: string): string {
  return '@' + username.toLowerCase().replace(/\s+/g, '');
}

function toProfile(row: DbProfileRow): Profile {
  return {
    name: row.username,
    handle: toHandle(row.username),
    points: row.points,
    avatar: row.username.trim().charAt(0).toUpperCase() || 'M',
    joined: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  };
}

export const gameApi = {
  canPost(kind: 'situation' | 'advice') {
    const last = Number(
      localStorage.getItem(`bro-dont-last-${kind}`) || 0
    );
    return Date.now() - last > 15_000;
  },

  markPost(kind: 'situation' | 'advice') {
    localStorage.setItem(
      `bro-dont-last-${kind}`,
      String(Date.now())
    );
  },

  // Ensures an anonymous Supabase Auth session exists and returns its user id.
  async getUserId(): Promise<string> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) return sessionData.session.user.id;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.session?.user) throw new Error('Failed to start an anonymous session.');
    return data.session.user.id;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, points, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data ? toProfile(data) : null;
  },

  async createProfile(userId: string, username: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: userId, username })
      .select('username, points, created_at')
      .single();

    if (error) throw error;
    return toProfile(data);
  },

  async addPoints(userId: string, delta: number, currentPoints: number): Promise<number> {
    const next = currentPoints + delta;
    const { error } = await supabase
      .from('profiles')
      .update({ points: next })
      .eq('id', userId);

    if (error) throw error;
    return next;
  },

  async getLeaderboard(limit = 20): Promise<{ username: string; points: number }[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, points')
      .order('points', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  // Returns real category activity from the existing situations table.
  // This uses existing community activity as the traffic signal; no new
  // analytics table or invented metric is introduced.
  async getCategoryTraffic(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('situations')
      .select('tag');

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (!row.tag) continue;
      counts[row.tag] = (counts[row.tag] || 0) + 1;
    }

    return counts;
  },

  async getSituations(currentUserId: string | null): Promise<Situation[]> {
    const { data, error } = await supabase
      .from('situations')
      .select(`
        id, title, context, tag, created_at,
        profiles ( username ),
        advice (
          id, text, created_at,
          profiles ( username ),
          votes ( user_id )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load situations:', error);
      throw error;
    }

    return (data ?? []).map((row: any) => {
      const advice: Advice[] = (row.advice ?? [])
        .slice()
        .sort((x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
        .map((a: any) => ({
          id: a.id,
          text: a.text,
          author: a.profiles?.username ? toHandle(a.profiles.username) : 'anonymous',
          votes: (a.votes ?? []).length,
          mine: currentUserId ? (a.votes ?? []).some((v: any) => v.user_id === currentUserId) : false,
        }));

      const voteTotal = advice.reduce((n, a) => n + a.votes, 0);

      return {
        id: row.id,
        title: row.title,
        context: row.context,
        tag: row.tag,
        author: row.profiles?.username ? toHandle(row.profiles.username) : 'anonymous',
        time: row.created_at,
        advice,
        hot: advice.length * 7 + voteTotal,
      };
    });
  },

  async createSituation(userId: string, title: string, context: string, tag: string) {
    const { data, error } = await supabase
      .from('situations')
      .insert({ user_id: userId, title, context, tag })
      .select('id, title, context, tag, created_at')
      .single();

    if (error) throw error;
    return { id: data.id, title: data.title, context: data.context, tag: data.tag, time: data.created_at };
  },

  async createAdvice(userId: string, situationId: string, text: string) {
    const { data, error } = await supabase
      .from('advice')
      .insert({ user_id: userId, situation_id: situationId, text })
      .select('id, text')
      .single();

    if (error) throw error;
    return { id: data.id, text: data.text };
  },

  async castVote(adviceId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('votes')
      .insert({ advice_id: adviceId, user_id: userId });

    if (error) throw error;
  },
};