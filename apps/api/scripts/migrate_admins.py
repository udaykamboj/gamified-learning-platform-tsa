import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.db.users import User, AdminUser
from sqlmodel import select

async def migrate_admins():
    async for db_session in get_db_session():
        # Get all users with is_superadmin = True
        statement = select(User).where(User.is_superadmin == True)
        users = (await db_session.execute(statement)).scalars().all()
        
        for user in users:
            # Check if already in AdminUser
            admin_stmt = select(AdminUser).where(AdminUser.email == user.email)
            existing = (await db_session.execute(admin_stmt)).scalars().first()
            if not existing:
                new_admin = AdminUser(
                    username=user.username,
                    email=user.email,
                    password=user.password,
                    user_uuid=user.user_uuid,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    is_superadmin=True
                )
                db_session.add(new_admin)
                print(f"Migrated admin: {user.email}")
                
        await db_session.commit()
        print("Migration complete.")
        break

if __name__ == "__main__":
    asyncio.run(migrate_admins())
