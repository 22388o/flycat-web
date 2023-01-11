export function timeSince(timestamp: number): string {
  const currentTime = Date.now() / 1000;
  const timeDifference = currentTime - timestamp;

  if (timeDifference < 60) {
    return `约 ${Math.floor(timeDifference)} 秒钟前`;
  } else if (timeDifference < 3600) {
    return `约 ${Math.floor(timeDifference / 60)} 分钟前`;
  } else if (timeDifference < 86400) {
    return `约 ${Math.floor(timeDifference / 3600)} 小时前`;
  } else if (timeDifference < 2592000) {
    return `约 ${Math.floor(timeDifference / 86400)} 天前`;
  } else {
    return `约 ${Math.floor(timeDifference / 2592000)} 月前`;
  }
}