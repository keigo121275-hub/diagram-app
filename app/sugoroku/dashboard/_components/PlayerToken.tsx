import type { Member } from "@/lib/supabase/types";

export function PlayerToken({
  member,
}: {
  member: Pick<Member, "name" | "avatar_url">;
}) {
  const initials = member.name.slice(0, 2).toUpperCase();
  return (
    <div
      className="absolute"
      style={{
        top: "7px",
        right: "7px",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: "2px solid #fff",
        boxShadow: "0 0 12px rgba(108,99,255,0.6)",
        animation: "float 3s ease-in-out infinite",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {member.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-xs font-bold"
          style={{
            background: "linear-gradient(135deg, #6c63ff, #4ade80)",
            color: "#fff",
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
