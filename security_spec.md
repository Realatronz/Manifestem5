# Firestore Security Specification - Mark 1

## Data Invariants
1. **User Identity**: A user document can only be created by the owner (request.auth.uid == userId).
2. **Post Ownership**: Only the author can update their post content or delete it.
3. **Relational Integrity**: Notifications must be for the user in the path.
4. **Academy Admittance**: Access to academy messages is Restricted to registered users (for public) or members (for private).
5. **Direct Messages**: Conversations are strictly limited to the two participants identified in the `conversationId`.
6. **Immutable Fields**: `authorId`, `createdAt`, `userId` should generally be immutable after creation.
7. **Role Protection**: Users cannot set their own `isAdmin: true` or change their `role` to 'admin' unless they are already an admin.

## The "Dirty Dozen" Payloads

1. **Self-Promotion**: Create a user document with `role: 'admin'`.
2. **Ghost Update**: Update a post with an extra field `isPromoted: true`.
3. **Identity Spoofing**: Post a message with `authorId` pointing to another user.
4. **Illegal Reaction**: Update a message's `reactions` but also attempt to change the `content`.
5. **Private Leak**: Read a `direct_messages` document where the user ID is not in the `conversationId`.
6. **Resource Poisoning**: Create a post with a 1MB string as the `author.name`.
7. **Negative Stats**: Update `followersCount` to -1.
8. **Orphaned Message**: Create a message in an academy that doesn't exist.
9. **Spam Notification**: Create a notification in another user's subcollection using a spoofed `from.id`.
10. **Typing Flood**: Send a typing status update with a 1MB map.
11. **Feedback Injection**: Submit feedback for another user.
12. **Post Hijacking**: Delete someone else's post as a non-admin.

## Test Suite Requirements
The `firestore.rules` must be verified using the above payloads. All should return `PERMISSION_DENIED` unless authorized (e.g., admin deleting a post).
