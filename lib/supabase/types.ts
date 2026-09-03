// Hand-written to match supabase/migrations/*.sql. If the schema drifts,
// regenerate with `supabase gen types typescript --linked` and reconcile —
// this file is a stand-in for that until a live project exists.
//
// Every table below carries `Relationships: []` even though real foreign
// keys exist (poll_options.poll_id -> polls.id, etc.) — @supabase/postgrest-js
// requires that field to structurally match GenericTable, but without a real
// generated Relationships array it can't type embedded selects like
// `polls.select("author:profiles(display_name)")` as anything more specific
// than `unknown`. Those call sites cast explicitly instead; see the comment
// in app/g/[slug]/page.tsx.

export type MemberRole = "owner" | "admin" | "member";
export type PollType = "single" | "multi" | "rank" | "bracket";
export type PollStatus = "open" | "closed";

export interface PollSettings {
  allow_option_adds?: boolean;
  option_adds_need_approval?: boolean;
  allow_vote_change?: boolean;
  anonymous?: boolean;
  results_visibility?: "always" | "after_vote" | "after_close";
  max_picks?: number;
  min_picks?: number;
  top_n?: number;
  /** Hex color (e.g. "#E8623D") the poll's author picked to display this
   * poll's selection highlight and results bars with. Optional — older
   * polls fall back to the app's default accent. */
  color?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          slug: string;
          invite_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["groups"]["Row"]> & {
          name: string;
          slug: string;
          invite_code: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Row"]>;
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: MemberRole;
          joined_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["group_members"]["Row"]> & {
          group_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_members"]["Row"]>;
        Relationships: [];
      };
      polls: {
        Row: {
          id: string;
          group_id: string;
          author_id: string;
          question: string;
          description: string | null;
          type: PollType;
          settings: PollSettings;
          status: PollStatus;
          closes_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["polls"]["Row"]> & {
          group_id: string;
          author_id: string;
          question: string;
          type: PollType;
        };
        Update: Partial<Database["public"]["Tables"]["polls"]["Row"]>;
        Relationships: [];
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          label: string;
          image_url: string | null;
          added_by: string;
          position: number;
          approved: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["poll_options"]["Row"]> & {
          poll_id: string;
          label: string;
          added_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["poll_options"]["Row"]>;
        Relationships: [];
      };
      ballots: {
        Row: {
          id: string;
          poll_id: string;
          voter_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ballots"]["Row"]> & {
          poll_id: string;
          voter_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["ballots"]["Row"]>;
        Relationships: [];
      };
      ballot_entries: {
        Row: {
          ballot_id: string;
          option_id: string;
          rank: number | null;
        };
        Insert: Database["public"]["Tables"]["ballot_entries"]["Row"];
        Update: Partial<Database["public"]["Tables"]["ballot_entries"]["Row"]>;
        Relationships: [];
      };
      matchups: {
        Row: {
          id: string;
          poll_id: string;
          voter_id: string;
          option_a_id: string;
          option_b_id: string;
          winner_option_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["matchups"]["Row"]> & {
          poll_id: string;
          voter_id: string;
          option_a_id: string;
          option_b_id: string;
          winner_option_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["matchups"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      preview_group_by_code: {
        Args: { p_code: string };
        Returns: { name: string; member_count: number }[];
      };
      join_group_by_code: {
        Args: { p_code: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      add_poll_option: {
        Args: { p_poll_id: string; p_label: string; p_image_url?: string | null };
        Returns: Database["public"]["Tables"]["poll_options"]["Row"];
      };
      approve_poll_option: {
        Args: { p_option_id: string };
        Returns: Database["public"]["Tables"]["poll_options"]["Row"];
      };
      cast_ballot: {
        Args: { p_poll_id: string; p_option_ids: string[]; p_ranks?: number[] | null };
        Returns: string;
      };
      record_matchup: {
        Args: { p_poll_id: string; p_option_a: string; p_option_b: string; p_winner: string };
        Returns: string;
      };
      get_next_matchup: {
        Args: { p_poll_id: string };
        Returns: { option_a_id: string; option_b_id: string }[];
      };
      get_poll_results: {
        Args: { p_poll_id: string };
        Returns: {
          option_id: string;
          label: string;
          image_url: string | null;
          score: number;
          votes: number;
        }[];
      };
      get_poll_voters: {
        Args: { p_poll_id: string };
        Returns: { option_id: string; voter_name: string }[];
      };
    };
    Enums: {
      member_role: MemberRole;
      poll_type: PollType;
      poll_status: PollStatus;
    };
  };
}
