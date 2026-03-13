import React from 'react';
import {
  Globe, Smartphone, Network, ShieldCheck, User, Package, CreditCard, Bell, Database,
  Zap, MessageSquare, Server, Monitor, Lock, ClipboardList, Wrench, FileText, Rocket,
  Palette, Settings, Cpu, Bot, Laptop, Box, Key, HelpCircle, Users, CheckCircle, Workflow,
  Flame, TrendingUp, RotateCcw, AlertTriangle, BarChart
} from 'lucide-react';

import {
  MdPublic, MdSmartphone, MdDeviceHub, MdSecurity, MdPerson, MdInventory, MdCreditCard,
  MdNotifications, MdStorage, MdElectricBolt, MdMessage, MdDns, MdDesktopMac, MdLock,
  MdListAlt, MdBuild, MdInsertDriveFile, MdRocketLaunch, MdPalette, MdSettings, MdMemory,
  MdSmartToy, MdLaptop, MdWidgets, MdKey, MdHelp, MdGroups, MdCheckCircle, MdAccountTree,
  MdLocalFireDepartment, MdTrendingUp, MdHistory, MdWarning, MdBarChart
} from 'react-icons/md';

import {
  HiGlobeAlt, HiDevicePhoneMobile, HiServerStack, HiShieldCheck, HiUser, HiCube,
  HiCreditCard, HiBell, HiCircleStack, HiBolt, HiChatBubbleLeftEllipsis, HiServer,
  HiComputerDesktop, HiLockClosed, HiClipboardDocumentList, HiWrenchScrewdriver,
  HiDocumentText, HiRocketLaunch, HiPaintBrush, HiCog8Tooth, HiCpuChip, HiSparkles,
  HiWrench, HiCheckCircle, HiUsers, HiFire, HiArrowTrendingUp, HiArrowUturnLeft,
  HiExclamationTriangle, HiChartBar
} from 'react-icons/hi2';

import {
  IoGlobeOutline, IoPhonePortraitOutline, IoGitNetworkOutline, IoShieldCheckmarkOutline,
  IoPersonOutline, IoCubeOutline, IoCardOutline, IoNotificationsOutline, IoServerOutline,
  IoFlashOutline, IoChatbubbleOutline, IoDesktopOutline, IoLockClosedOutline,
  IoClipboardOutline, IoBuildOutline, IoDocumentTextOutline, IoRocketOutline,
  IoColorPaletteOutline, IoSettingsOutline, IoHardwareChipOutline, IoSparklesOutline,
  IoLaptopOutline, IoKeyOutline, IoHelpCircleOutline, IoPeopleOutline,
  IoCheckmarkCircleOutline, IoTrendingUpOutline, IoRefreshOutline, IoWarningOutline,
  IoBarChartOutline, IoFlameOutline
} from 'react-icons/io5';

const LUCIDE_ICON_MAP: Record<string, React.ElementType> = {
  'web': Globe, 'internet': Globe, 'www': Globe,
  'org': Network, 'teams': Users, 'group': Users, 'workflow': Workflow,
  'qa': CheckCircle, 'check': CheckCircle, 'quality': CheckCircle, 'test': CheckCircle,
  'fire': Flame, 'incident': Flame, 'alert': AlertTriangle, 'warning': AlertTriangle,
  'scale': TrendingUp, 'growth': TrendingUp, 'rollback': RotateCcw, 'undo': RotateCcw,
  'fix': Wrench, 'patch': Wrench, 'hotfix': Wrench,
  'metrics': BarChart, 'chart': BarChart, 'observability': BarChart, 'graph': BarChart, 'stats': BarChart,
  'mobile': Smartphone, 'phone': Smartphone, 'app': Smartphone,
  'desktop': Monitor, 'computer': Monitor, 'laptop': Laptop,
  'gateway': Network, 'network': Network, 'infra': Server, 'server': Server,
  'database': Database, 'db': Database, 'redis': Zap, 'queue': MessageSquare, 'rabbitmq': MessageSquare, 'cloud': Server,
  'auth': ShieldCheck, 'security': Lock, 'lock': Lock, 'key': Key,
  'user': User, 'person': User, 'admin': User, 'customer': User, 'engineer': User, 'lead': User,
  'orders': Package, 'package': Package, 'box': Box, 'payments': CreditCard, 'card': CreditCard, 'billing': CreditCard,
  'notifications': Bell, 'email': MessageSquare, 'chat': MessageSquare,
  'tools': Wrench, 'config': Settings, 'settings': Settings, 'docs': FileText, 'file': FileText, 'code': FileText,
  'deploy': Rocket, 'release': Rocket, 'design': Palette, 'frontend': Laptop, 'backend': Server,
  'ai': Bot, 'ml': Cpu, 'bot': Bot,
  'list': ClipboardList, 'clipboard': ClipboardList, 'task': ClipboardList, 'unknown': HelpCircle,
};

const MD_ICON_MAP: Record<string, React.ElementType> = {
  'web': MdPublic, 'internet': MdPublic, 'www': MdPublic,
  'org': MdAccountTree, 'teams': MdGroups, 'group': MdGroups, 'workflow': MdAccountTree,
  'qa': MdCheckCircle, 'check': MdCheckCircle, 'quality': MdCheckCircle, 'test': MdCheckCircle,
  'fire': MdLocalFireDepartment, 'incident': MdLocalFireDepartment, 'alert': MdWarning, 'warning': MdWarning,
  'scale': MdTrendingUp, 'growth': MdTrendingUp, 'rollback': MdHistory, 'undo': MdHistory,
  'fix': MdBuild, 'patch': MdBuild, 'hotfix': MdBuild,
  'metrics': MdBarChart, 'chart': MdBarChart, 'observability': MdBarChart, 'graph': MdBarChart, 'stats': MdBarChart,
  'mobile': MdSmartphone, 'phone': MdSmartphone, 'app': MdSmartphone,
  'desktop': MdDesktopMac, 'computer': MdDesktopMac, 'laptop': MdLaptop,
  'gateway': MdDeviceHub, 'network': MdDeviceHub, 'infra': MdDns, 'server': MdDns,
  'database': MdStorage, 'db': MdStorage, 'redis': MdElectricBolt, 'queue': MdMessage, 'rabbitmq': MdMessage, 'cloud': MdDns,
  'auth': MdSecurity, 'security': MdLock, 'lock': MdLock, 'key': MdKey,
  'user': MdPerson, 'person': MdPerson, 'admin': MdPerson, 'customer': MdPerson, 'engineer': MdPerson, 'lead': MdPerson,
  'orders': MdInventory, 'package': MdInventory, 'box': MdWidgets, 'payments': MdCreditCard, 'card': MdCreditCard, 'billing': MdCreditCard,
  'notifications': MdNotifications, 'email': MdMessage, 'chat': MdMessage,
  'tools': MdBuild, 'config': MdSettings, 'settings': MdSettings, 'docs': MdInsertDriveFile, 'file': MdInsertDriveFile, 'code': MdInsertDriveFile,
  'deploy': MdRocketLaunch, 'release': MdRocketLaunch, 'design': MdPalette, 'frontend': MdLaptop, 'backend': MdDns,
  'ai': MdSmartToy, 'ml': MdMemory, 'bot': MdSmartToy,
  'list': MdListAlt, 'clipboard': MdListAlt, 'task': MdListAlt, 'unknown': MdHelp,
};

const HI_ICON_MAP: Record<string, React.ElementType> = {
  'web': HiGlobeAlt, 'internet': HiGlobeAlt, 'www': HiGlobeAlt,
  'org': HiServerStack, 'teams': HiUsers, 'group': HiUsers, 'workflow': HiServerStack,
  'qa': HiCheckCircle, 'check': HiCheckCircle, 'quality': HiCheckCircle, 'test': HiCheckCircle,
  'fire': HiFire, 'incident': HiFire, 'alert': HiExclamationTriangle, 'warning': HiExclamationTriangle,
  'scale': HiArrowTrendingUp, 'growth': HiArrowTrendingUp, 'rollback': HiArrowUturnLeft, 'undo': HiArrowUturnLeft,
  'fix': HiWrenchScrewdriver, 'patch': HiWrenchScrewdriver, 'hotfix': HiWrenchScrewdriver,
  'metrics': HiChartBar, 'chart': HiChartBar, 'observability': HiChartBar, 'graph': HiChartBar, 'stats': HiChartBar,
  'mobile': HiDevicePhoneMobile, 'phone': HiDevicePhoneMobile, 'app': HiDevicePhoneMobile,
  'desktop': HiComputerDesktop, 'computer': HiComputerDesktop, 'laptop': HiComputerDesktop,
  'gateway': HiServerStack, 'network': HiServerStack, 'infra': HiServer, 'server': HiServer,
  'database': HiCircleStack, 'db': HiCircleStack, 'redis': HiBolt, 'queue': HiChatBubbleLeftEllipsis, 'rabbitmq': HiChatBubbleLeftEllipsis, 'cloud': HiServer,
  'auth': HiShieldCheck, 'security': HiLockClosed, 'lock': HiLockClosed, 'key': HiWrench,
  'user': HiUser, 'person': HiUser, 'admin': HiUser, 'customer': HiUser, 'engineer': HiUser, 'lead': HiUser,
  'orders': HiCube, 'package': HiCube, 'box': HiCube, 'payments': HiCreditCard, 'card': HiCreditCard, 'billing': HiCreditCard,
  'notifications': HiBell, 'email': HiChatBubbleLeftEllipsis, 'chat': HiChatBubbleLeftEllipsis,
  'tools': HiWrenchScrewdriver, 'config': HiCog8Tooth, 'settings': HiCog8Tooth, 'docs': HiDocumentText, 'file': HiDocumentText, 'code': HiDocumentText,
  'deploy': HiRocketLaunch, 'release': HiRocketLaunch, 'design': HiPaintBrush, 'frontend': HiComputerDesktop, 'backend': HiServer,
  'ai': HiSparkles, 'ml': HiCpuChip, 'bot': HiSparkles,
  'list': HiClipboardDocumentList, 'clipboard': HiClipboardDocumentList, 'task': HiClipboardDocumentList, 'unknown': HiGlobeAlt,
};

const IO_ICON_MAP: Record<string, React.ElementType> = {
  'web': IoGlobeOutline, 'internet': IoGlobeOutline, 'www': IoGlobeOutline,
  'org': IoGitNetworkOutline, 'teams': IoPeopleOutline, 'group': IoPeopleOutline, 'workflow': IoGitNetworkOutline,
  'qa': IoCheckmarkCircleOutline, 'check': IoCheckmarkCircleOutline, 'quality': IoCheckmarkCircleOutline, 'test': IoCheckmarkCircleOutline,
  'fire': IoFlameOutline, 'incident': IoFlameOutline, 'alert': IoWarningOutline, 'warning': IoWarningOutline,
  'scale': IoTrendingUpOutline, 'growth': IoTrendingUpOutline, 'rollback': IoRefreshOutline, 'undo': IoRefreshOutline,
  'fix': IoBuildOutline, 'patch': IoBuildOutline, 'hotfix': IoBuildOutline,
  'metrics': IoBarChartOutline, 'chart': IoBarChartOutline, 'observability': IoBarChartOutline, 'graph': IoBarChartOutline, 'stats': IoBarChartOutline,
  'mobile': IoPhonePortraitOutline, 'phone': IoPhonePortraitOutline, 'app': IoPhonePortraitOutline,
  'desktop': IoDesktopOutline, 'computer': IoDesktopOutline, 'laptop': IoLaptopOutline,
  'gateway': IoGitNetworkOutline, 'network': IoGitNetworkOutline, 'infra': IoServerOutline, 'server': IoServerOutline,
  'database': IoServerOutline, 'db': IoServerOutline, 'redis': IoFlashOutline, 'queue': IoChatbubbleOutline, 'rabbitmq': IoChatbubbleOutline, 'cloud': IoServerOutline,
  'auth': IoShieldCheckmarkOutline, 'security': IoLockClosedOutline, 'lock': IoLockClosedOutline, 'key': IoKeyOutline,
  'user': IoPersonOutline, 'person': IoPersonOutline, 'admin': IoPersonOutline, 'customer': IoPersonOutline, 'engineer': IoPersonOutline, 'lead': IoPersonOutline,
  'orders': IoCubeOutline, 'package': IoCubeOutline, 'box': IoCubeOutline, 'payments': IoCardOutline, 'card': IoCardOutline, 'billing': IoCardOutline,
  'notifications': IoNotificationsOutline, 'email': IoChatbubbleOutline, 'chat': IoChatbubbleOutline,
  'tools': IoBuildOutline, 'config': IoSettingsOutline, 'settings': IoSettingsOutline, 'docs': IoDocumentTextOutline, 'file': IoDocumentTextOutline, 'code': IoDocumentTextOutline,
  'deploy': IoRocketOutline, 'release': IoRocketOutline, 'design': IoColorPaletteOutline, 'frontend': IoLaptopOutline, 'backend': IoServerOutline,
  'ai': IoSparklesOutline, 'ml': IoHardwareChipOutline, 'bot': IoSparklesOutline,
  'list': IoClipboardOutline, 'clipboard': IoClipboardOutline, 'task': IoClipboardOutline, 'unknown': IoHelpCircleOutline,
};

export const ICON_MAP = LUCIDE_ICON_MAP; // For backwards compatibility

/**
 * Resolves an icon name (or emoji fallback) to a specific icon library based on theme.
 * If the icon name is not found, returns a default icon or null depending on strict mode.
 */
export function resolveIcon(name: string, themeId: string = 'light'): React.ElementType | null {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  
  let map = LUCIDE_ICON_MAP;
  if (themeId.includes('google') || themeId.includes('angular')) {
    map = MD_ICON_MAP;
  } else if (themeId.includes('tailwind')) {
    map = HI_ICON_MAP;
  } else if (themeId.includes('uber')) {
    map = IO_ICON_MAP;
  }
  
  return map[key] || LUCIDE_ICON_MAP[key] || null;
}
