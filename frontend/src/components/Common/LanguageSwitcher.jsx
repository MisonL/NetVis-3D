import React from 'react';
import { Dropdown, Button, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useI18n } from '../../context/I18nContext';

const LanguageSwitcher = ({ style }) => {
  const { locale, setLocale, supportedLocales, localeNames } = useI18n();

  const items = supportedLocales.map((loc) => ({
    key: loc,
    label: localeNames[loc],
    onClick: () => setLocale(loc),
  }));

  return (
    <Dropdown menu={{ items, selectedKeys: [locale] }} trigger={['click']}>
      <Button icon={<GlobalOutlined />} style={style}>
        <Space>
          {localeNames[locale]}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default LanguageSwitcher;
