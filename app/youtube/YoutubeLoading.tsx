type Props = {
  message: string;
  /** Bottleneck など狭いスピナー用 */
  size?: "md" | "sm";
};

export default function YoutubeLoading({ message, size = "md" }: Props) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <div className={`animate-spin rounded-full ${dim} border-b-2 border-red-500 mr-3`} />
      {message}
    </div>
  );
}
