import { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { LucideIcon } from 'lucide-react';

interface Author {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface ContentHeaderCardProps {
  icon: LucideIcon;
  title: string;
  badge?: {
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  author?: Author;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  shareButton?: ReactNode;
  actions?: ReactNode;
}

export function ContentHeaderCard({
  icon: Icon,
  title,
  badge,
  author,
  createdAt,
  updatedAt,
  shareButton,
  actions,
}: ContentHeaderCardProps) {
  return (
    <div className="-mx-6 px-6 flex items-start justify-between gap-4 mb-6">
      <div className="flex-1 min-w-0">
        {/* Title row with icon */}
        <div className="flex items-start gap-3 mb-3">
          <Icon className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold" data-testid="text-title">
              {title}
            </h2>
            {badge && (
              <Badge variant={badge.variant || 'secondary'} data-testid="badge-status">
                {badge.label}
              </Badge>
            )}
          </div>
        </div>
        {/* Metadata row with avatar */}
        {author && (
          <div className="flex items-center gap-3">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={author.avatarUrl || undefined} />
              <AvatarFallback>
                {author.displayName?.[0] || author.username[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span data-testid="text-author">
                {author.displayName || author.username}
              </span>
              {createdAt && (
                <>
                  <span>•</span>
                  <span data-testid="text-created">
                    Created on {format(new Date(createdAt), 'MMM d, yyyy')} at{' '}
                    {format(new Date(createdAt), 'p')}
                  </span>
                </>
              )}
              {updatedAt &&
                createdAt &&
                new Date(updatedAt).getTime() !== new Date(createdAt).getTime() && (
                  <>
                    <span>•</span>
                    <span data-testid="text-updated">
                      Updated on {format(new Date(updatedAt), 'MMM d, yyyy')} at{' '}
                      {format(new Date(updatedAt), 'p')}
                    </span>
                  </>
                )}
            </div>
          </div>
        )}
      </div>
      {/* Share + Actions aligned to the right */}
      {(shareButton || actions) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {shareButton}
          {actions}
        </div>
      )}
    </div>
  );
}
